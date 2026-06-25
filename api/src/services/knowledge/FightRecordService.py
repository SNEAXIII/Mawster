import math
import uuid
from datetime import datetime
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import func, literal, null, union_all
from sqlalchemy.orm import aliased, selectinload
from sqlmodel import and_, select
from starlette import status

from src.dto.admin.dto_fight_record import (
    PaginatedFightRecordsResponse,
    WarFightRecordResponse,
    WarFightSynergyResponse,
    WarFightPrefightResponse,
)
from src.enums.FightRecordSource import FightRecordSource
from src.enums.SeasonSelectorType import SeasonSelectorType
from src.models.Alliance import Alliance
from src.models.AllianceVisitor import AllianceVisitor
from src.models.Champion import Champion
from src.models.ChampionUser import ChampionUser
from src.models.GameAccount import GameAccount
from src.enums.SeasonStatus import SeasonStatus
from src.models.Season import Season
from src.models.War import War
from src.models.WarDefensePlacement import WarDefensePlacement
from src.models.WarFightPrefight import WarFightPrefight
from src.models.WarFightNote import WarFightNote
from src.services.admin.ModerationService import AUTO_BLOCK_THRESHOLD, ModerationService
from src.models.WarFightRecord import WarFightRecord
from src.models.WarFightRecordImport import WarFightRecordImport
from src.models.WarFightSynergy import WarFightSynergy
from src.models.WarPrefightAttacker import WarPrefightAttacker
from src.models.WarSynergyAttacker import WarSynergyAttacker
from src.utils.db import SessionDep


class FightRecordService:
    @classmethod
    async def snapshot_war(cls, session: SessionDep, war: War) -> None:
        if war.snapshotted_at is not None:
            return

        stmt = (
            select(WarDefensePlacement)
            .where(
                and_(
                    WarDefensePlacement.war_id == war.id,
                    WarDefensePlacement.attacker_champion_user_id.isnot(None),
                    WarDefensePlacement.is_fight_not_done == False,  # noqa: E712
                )
            )
            .options(
                selectinload(WarDefensePlacement.attacker_champion_user).selectinload(
                    ChampionUser.champion
                ),
                selectinload(WarDefensePlacement.champion),
            )
        )
        result = await session.exec(stmt)
        placements = result.all()

        for placement in placements:
            attacker_cu: ChampionUser = placement.attacker_champion_user
            attacker_champ: Champion = attacker_cu.champion
            defender_champ: Champion = placement.champion

            record = WarFightRecord(
                war_id=war.id,
                alliance_id=war.alliance_id,
                season_id=war.season_id,
                game_account_id=attacker_cu.game_account_id,
                battlegroup=placement.battlegroup,
                node_number=placement.node_number,
                tier=war.tier,
                champion_id=attacker_champ.id,
                stars=attacker_cu.stars,
                rank=attacker_cu.rank,
                ascension=attacker_cu.ascension,
                is_saga_attacker=attacker_champ.is_saga_attacker,
                defender_champion_id=defender_champ.id,
                defender_stars=placement.stars,
                defender_rank=placement.rank,
                defender_ascension=placement.ascension,
                defender_is_saga_defender=defender_champ.is_saga_defender,
                ko_count=placement.ko_count,
                is_planning_error=placement.is_planning_error,
                assisted=placement.assist_champion_user_id is not None,
            )
            session.add(record)
            await session.flush()

            note = (
                await session.exec(
                    select(WarFightNote).where(
                        and_(
                            WarFightNote.war_id == war.id,
                            WarFightNote.battlegroup == placement.battlegroup,
                            WarFightNote.node_number == placement.node_number,
                        )
                    )
                )
            ).first()
            if note is not None:
                note.war_fight_record_id = record.id
                session.add(note)

            pf_stmt = (
                select(WarPrefightAttacker)
                .where(
                    and_(
                        WarPrefightAttacker.war_id == war.id,
                        WarPrefightAttacker.battlegroup == placement.battlegroup,
                        WarPrefightAttacker.target_node_number == placement.node_number,
                    )
                )
                .options(selectinload(WarPrefightAttacker.champion_user))
            )
            pf_result = await session.exec(pf_stmt)
            for pf in pf_result.all():
                pf_cu: ChampionUser = pf.champion_user
                session.add(
                    WarFightPrefight(
                        war_fight_record_id=record.id,
                        champion_id=pf_cu.champion_id,
                        stars=pf_cu.stars,
                        ascension=pf_cu.ascension,
                    )
                )

            syn_stmt = (
                select(WarSynergyAttacker)
                .where(
                    and_(
                        WarSynergyAttacker.war_id == war.id,
                        WarSynergyAttacker.battlegroup == placement.battlegroup,
                        WarSynergyAttacker.target_champion_user_id
                        == placement.attacker_champion_user_id,
                    )
                )
                .options(selectinload(WarSynergyAttacker.champion_user))
            )
            syn_result = await session.exec(syn_stmt)
            for syn in syn_result.all():
                syn_cu: ChampionUser = syn.champion_user
                session.add(
                    WarFightSynergy(
                        war_fight_record_id=record.id,
                        champion_id=syn_cu.champion_id,
                        stars=syn_cu.stars,
                        ascension=syn_cu.ascension,
                    )
                )

        await session.commit()

        await session.refresh(war)
        war.snapshotted_at = datetime.now()
        session.add(war)
        await session.commit()

    @classmethod
    async def assert_user_in_alliance(cls, session: SessionDep, user_id: uuid.UUID) -> None:
        member_result = await session.exec(
            select(GameAccount).where(
                and_(
                    GameAccount.user_id == user_id,
                    GameAccount.alliance_id.isnot(None),
                )
            )
        )
        if member_result.first() is not None:
            return

        visitor_result = await session.exec(
            select(AllianceVisitor)
            .join(GameAccount, AllianceVisitor.game_account_id == GameAccount.id)
            .where(GameAccount.user_id == user_id)
        )
        if visitor_result.first() is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User must belong to or visit an alliance",
            )

    @classmethod
    async def get_accessible_alliance_ids(
        cls, session: SessionDep, user_id: uuid.UUID
    ) -> list[uuid.UUID]:
        member_result = await session.exec(
            select(GameAccount.alliance_id).where(
                and_(
                    GameAccount.user_id == user_id,
                    GameAccount.alliance_id.isnot(None),
                )
            )
        )
        member_ids: set[uuid.UUID] = set(member_result.all())

        visitor_result = await session.exec(
            select(AllianceVisitor.alliance_id)
            .join(GameAccount, AllianceVisitor.game_account_id == GameAccount.id)
            .where(GameAccount.user_id == user_id)
        )
        visitor_ids: set[uuid.UUID] = set(visitor_result.all())

        return list(member_ids | visitor_ids)

    @classmethod
    def _season_conditions(cls, model, season_selector, season_id):
        """Return season filter conditions for any model with a season_id column."""
        if season_selector == SeasonSelectorType.AllSeasons:
            return [model.season_id.isnot(None)]
        if season_selector == SeasonSelectorType.OffSeason:
            return [model.season_id.is_(None)]
        if season_selector == SeasonSelectorType.Current:
            return [
                model.season_id.in_(select(Season.id).where(Season.status == SeasonStatus.active))
            ]
        if season_selector == SeasonSelectorType.Specific and season_id:
            return [model.season_id == season_id]
        if season_id:
            return [model.season_id == season_id]
        return []

    @classmethod
    async def get_fight_records(
        cls,
        session: SessionDep,
        accessible_alliance_ids: list[uuid.UUID],
        source: FightRecordSource = FightRecordSource.NonImported,
        champion_id: Optional[uuid.UUID] = None,
        defender_champion_id: Optional[uuid.UUID] = None,
        node_number: Optional[int] = None,
        tier: Optional[int] = None,
        season_selector: Optional[SeasonSelectorType] = None,
        season_id: Optional[uuid.UUID] = None,
        alliance_id: Optional[uuid.UUID] = None,
        battlegroup: Optional[int] = None,
        game_account_pseudo: Optional[str] = None,
        planning_error_only: Optional[bool] = None,
        page: int = 1,
        size: int = 20,
        sort_by: str = "created_at",
        sort_order: str = "desc",
    ) -> PaginatedFightRecordsResponse:
        if not accessible_alliance_ids:
            return PaginatedFightRecordsResponse(items=[], total=0, page=page, size=size, pages=1)

        include_reg = source in (FightRecordSource.NonImported, FightRecordSource.All)
        include_imp = source in (FightRecordSource.Imported, FightRecordSource.All)

        # Aliases for the two champion joins in each sub-query
        RegAttacker = aliased(Champion)
        RegDefender = aliased(Champion)
        ImpAttacker = aliased(Champion)
        ImpDefender = aliased(Champion)

        sub_queries = []

        if include_reg:
            reg_conds = [WarFightRecord.alliance_id.in_(accessible_alliance_ids)]
            if champion_id:
                reg_conds.append(WarFightRecord.champion_id == champion_id)
            if defender_champion_id:
                reg_conds.append(WarFightRecord.defender_champion_id == defender_champion_id)
            if node_number is not None:
                reg_conds.append(WarFightRecord.node_number == node_number)
            if tier is not None:
                reg_conds.append(WarFightRecord.tier == tier)
            if battlegroup is not None:
                reg_conds.append(WarFightRecord.battlegroup == battlegroup)
            if planning_error_only is not None:
                reg_conds.append(WarFightRecord.is_planning_error == planning_error_only)
            if game_account_pseudo is not None:
                reg_conds.append(GameAccount.game_pseudo.ilike(f"%{game_account_pseudo}%"))
            if alliance_id:
                reg_conds.append(WarFightRecord.alliance_id == alliance_id)
            reg_conds.extend(cls._season_conditions(WarFightRecord, season_selector, season_id))

            reg_sub = (
                select(
                    WarFightRecord.id.label("id"),
                    WarFightRecord.alliance_id.label("alliance_id"),
                    WarFightRecord.season_id.label("season_id"),
                    WarFightRecord.node_number.label("node_number"),
                    WarFightRecord.champion_id.label("champion_id"),
                    WarFightRecord.defender_champion_id.label("defender_champion_id"),
                    WarFightRecord.ko_count.label("ko_count"),
                    WarFightRecord.created_at.label("created_at"),
                    WarFightRecord.war_id.label("war_id"),
                    WarFightRecord.battlegroup.label("battlegroup"),
                    WarFightRecord.tier.label("tier"),
                    WarFightRecord.stars.label("stars"),
                    WarFightRecord.rank.label("rank"),
                    WarFightRecord.ascension.label("ascension"),
                    WarFightRecord.is_saga_attacker.label("is_saga_attacker"),
                    WarFightRecord.defender_stars.label("defender_stars"),
                    WarFightRecord.defender_rank.label("defender_rank"),
                    WarFightRecord.defender_ascension.label("defender_ascension"),
                    WarFightRecord.defender_is_saga_defender.label("defender_is_saga_defender"),
                    WarFightRecord.is_planning_error.label("is_planning_error"),
                    WarFightRecord.assisted.label("assisted"),
                    literal(False).label("is_imported"),
                    Alliance.name.label("alliance_name"),
                    RegAttacker.name.label("champion_name"),
                    RegAttacker.champion_class.label("champion_class"),
                    RegAttacker.image_url.label("image_url"),
                    RegDefender.name.label("defender_champion_name"),
                    RegDefender.champion_class.label("defender_champion_class"),
                    RegDefender.image_url.label("defender_image_url"),
                    GameAccount.game_pseudo.label("game_account_pseudo"),
                )
                .join(Alliance, WarFightRecord.alliance_id == Alliance.id)
                .join(RegAttacker, WarFightRecord.champion_id == RegAttacker.id)
                .join(RegDefender, WarFightRecord.defender_champion_id == RegDefender.id)
                .join(GameAccount, WarFightRecord.game_account_id == GameAccount.id)
                .where(and_(*reg_conds))
            )
            sub_queries.append(reg_sub)

        # Imported records have no game account and no tier, so those filters can never match them.
        if include_imp and game_account_pseudo is None and tier is None:
            imp_conds = [WarFightRecordImport.alliance_id.in_(accessible_alliance_ids)]
            if champion_id:
                imp_conds.append(WarFightRecordImport.champion_id == champion_id)
            if defender_champion_id:
                imp_conds.append(WarFightRecordImport.defender_champion_id == defender_champion_id)
            if node_number is not None:
                imp_conds.append(WarFightRecordImport.node_number == node_number)
            if alliance_id:
                imp_conds.append(WarFightRecordImport.alliance_id == alliance_id)
            imp_conds.extend(
                cls._season_conditions(WarFightRecordImport, season_selector, season_id)
            )

            imp_sub = (
                select(
                    WarFightRecordImport.id.label("id"),
                    WarFightRecordImport.alliance_id.label("alliance_id"),
                    WarFightRecordImport.season_id.label("season_id"),
                    WarFightRecordImport.node_number.label("node_number"),
                    WarFightRecordImport.champion_id.label("champion_id"),
                    WarFightRecordImport.defender_champion_id.label("defender_champion_id"),
                    WarFightRecordImport.ko_count.label("ko_count"),
                    WarFightRecordImport.created_at.label("created_at"),
                    null().label("war_id"),
                    null().label("battlegroup"),
                    null().label("tier"),
                    null().label("stars"),
                    null().label("rank"),
                    null().label("ascension"),
                    null().label("is_saga_attacker"),
                    null().label("defender_stars"),
                    null().label("defender_rank"),
                    null().label("defender_ascension"),
                    null().label("defender_is_saga_defender"),
                    literal(False).label("is_planning_error"),
                    literal(False).label("assisted"),
                    literal(True).label("is_imported"),
                    Alliance.name.label("alliance_name"),
                    ImpAttacker.name.label("champion_name"),
                    ImpAttacker.champion_class.label("champion_class"),
                    ImpAttacker.image_url.label("image_url"),
                    ImpDefender.name.label("defender_champion_name"),
                    ImpDefender.champion_class.label("defender_champion_class"),
                    ImpDefender.image_url.label("defender_image_url"),
                    null().label("game_account_pseudo"),
                )
                .join(Alliance, WarFightRecordImport.alliance_id == Alliance.id)
                .join(ImpAttacker, WarFightRecordImport.champion_id == ImpAttacker.id)
                .join(ImpDefender, WarFightRecordImport.defender_champion_id == ImpDefender.id)
                .where(and_(*imp_conds))
            )
            sub_queries.append(imp_sub)

        if not sub_queries:
            return PaginatedFightRecordsResponse(items=[], total=0, page=page, size=size, pages=1)

        base = (union_all(*sub_queries) if len(sub_queries) > 1 else sub_queries[0]).subquery()

        # COUNT
        total = (await session.execute(select(func.count()).select_from(base))).scalar_one()

        # SORT — all labeled columns are directly accessible on the subquery
        sort_col_map = {
            "ko_count": base.c.ko_count,
            "tier": base.c.tier,
            "node_number": base.c.node_number,
            "battlegroup": base.c.battlegroup,
            "created_at": base.c.created_at,
            "champion_name": base.c.champion_name,
            "defender_champion_name": base.c.defender_champion_name,
            "alliance_name": base.c.alliance_name,
        }
        sort_col = sort_col_map.get(sort_by, base.c.created_at)
        sort_expr = sort_col.desc() if sort_order == "desc" else sort_col.asc()

        rows = (
            (
                await session.execute(
                    select(base).order_by(sort_expr).offset((page - 1) * size).limit(size)
                )
            )
            .mappings()
            .all()
        )

        # Map raw rows → WarFightRecordResponse
        items = [
            WarFightRecordResponse(
                id=row["id"],
                is_imported=row["is_imported"],
                war_id=row["war_id"],
                alliance_id=row["alliance_id"],
                alliance_name=row["alliance_name"],
                season_id=row["season_id"],
                game_account_pseudo=row["game_account_pseudo"],
                battlegroup=row["battlegroup"],
                node_number=row["node_number"],
                tier=row["tier"],
                champion_id=row["champion_id"],
                champion_name=row["champion_name"],
                champion_class=row["champion_class"],
                image_url=row["image_url"],
                stars=row["stars"],
                rank=row["rank"],
                ascension=row["ascension"],
                is_saga_attacker=row["is_saga_attacker"],
                defender_champion_id=row["defender_champion_id"],
                defender_champion_name=row["defender_champion_name"],
                defender_champion_class=row["defender_champion_class"],
                defender_image_url=row["defender_image_url"],
                defender_stars=row["defender_stars"],
                defender_rank=row["defender_rank"],
                defender_ascension=row["defender_ascension"],
                defender_is_saga_defender=row["defender_is_saga_defender"],
                ko_count=row["ko_count"],
                is_planning_error=bool(row["is_planning_error"]),
                assisted=bool(row["assisted"]),
                synergies=[],
                prefights=[],
                created_at=row["created_at"],
            )
            for row in rows
        ]

        # Load synergies + prefights for regular (non-imported) records in this page
        if include_reg:
            reg_ids = [item.id for item in items if not item.is_imported]
            if reg_ids:
                syn_rows = (
                    await session.exec(
                        select(WarFightSynergy)
                        .options(selectinload(WarFightSynergy.champion))
                        .where(WarFightSynergy.war_fight_record_id.in_(reg_ids))
                    )
                ).all()
                pf_rows = (
                    await session.exec(
                        select(WarFightPrefight)
                        .options(selectinload(WarFightPrefight.champion))
                        .where(WarFightPrefight.war_fight_record_id.in_(reg_ids))
                    )
                ).all()
                syns_by = {}
                for s in syn_rows:
                    syns_by.setdefault(s.war_fight_record_id, []).append(s)
                pfs_by = {}
                for p in pf_rows:
                    pfs_by.setdefault(p.war_fight_record_id, []).append(p)
                for item in items:
                    if not item.is_imported:
                        item.synergies = [
                            WarFightSynergyResponse.model_validate(s)
                            for s in syns_by.get(item.id, [])
                        ]
                        item.prefights = [
                            WarFightPrefightResponse.model_validate(p)
                            for p in pfs_by.get(item.id, [])
                        ]

        # Attach war fight notes to regular (non-imported) records in this page
        record_ids = [it.id for it in items if not it.is_imported]
        if record_ids:
            notes = (
                await session.exec(
                    select(WarFightNote).where(
                        and_(
                            WarFightNote.war_fight_record_id.in_(record_ids),
                            WarFightNote.deleted_at.is_(None),
                        )
                    )
                )
            ).all()
            note_by_record = {n.war_fight_record_id: n.content for n in notes}
            note_id_by_record = {n.war_fight_record_id: n.id for n in notes}
            # Pseudo of the author of the latest note version (updated_by).
            editor_ids = {n.updated_by_game_account_id for n in notes}
            pseudo_by_account = {}
            if editor_ids:
                editor_accounts = (
                    await session.exec(
                        select(GameAccount.id, GameAccount.game_pseudo).where(
                            GameAccount.id.in_(editor_ids)
                        )
                    )
                ).all()
                pseudo_by_account = {acc_id: pseudo for acc_id, pseudo in editor_accounts}
            author_by_record = {
                n.war_fight_record_id: pseudo_by_account.get(n.updated_by_game_account_id)
                for n in notes
            }
            counts = await ModerationService.pending_report_counts(session, [n.id for n in notes])
            blocked_records = {
                n.war_fight_record_id for n in notes if counts.get(n.id, 0) >= AUTO_BLOCK_THRESHOLD
            }
            for it in items:
                it.note_id = note_id_by_record.get(it.id)
                it.note_author = author_by_record.get(it.id)
                if it.id in blocked_records:
                    it.note = None
                    it.note_blocked = True
                else:
                    it.note = note_by_record.get(it.id)

        return PaginatedFightRecordsResponse(
            items=items,
            total=total,
            page=page,
            size=size,
            pages=max(1, math.ceil(total / size)),
        )

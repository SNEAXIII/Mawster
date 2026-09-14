import math
import uuid
from collections import defaultdict

from fastapi import HTTPException
from sqlalchemy import func, literal, null, union_all
from sqlalchemy.orm import aliased, selectinload
from sqlmodel import and_, select
from starlette import status

from src.dto.admin.dto_fight_record import (
    PaginatedFightRecordsResponse,
    WarFightPrefightResponse,
    WarFightRecordResponse,
    WarFightSynergyResponse,
)
from src.enums.FightRecordSource import FightRecordSource
from src.enums.SeasonSelectorType import SeasonSelectorType
from src.enums.SeasonStatus import SeasonStatus
from src.models.alliance.Alliance import Alliance
from src.models.alliance.AllianceVisitor import AllianceVisitor
from src.models.Base import utcnow
from src.models.champion.Champion import Champion
from src.models.champion.ChampionUser import ChampionUser
from src.models.user.GameAccount import GameAccount
from src.models.war.Season import Season
from src.models.war.War import War
from src.models.war.WarDefensePlacement import WarDefensePlacement
from src.models.war.WarFightNote import WarFightNote
from src.models.war.WarFightRecord import WarFightRecord
from src.models.war.WarFightRecordImport import WarFightRecordImport
from src.models.war.WarPrefightAttacker import WarPrefightAttacker
from src.models.war.WarSynergyAttacker import WarSynergyAttacker
from src.services.admin.ModerationService import AUTO_BLOCK_THRESHOLD, ModerationService
from src.services.admin.SagaService import SagaService
from src.services.knowledge._fight_context import join_fight_context
from src.utils.db import SessionDep

# Aliases for the two champion joins in each sub-query
reg_attacker = aliased(Champion)
reg_defender = aliased(Champion)
imp_attacker = aliased(Champion)
imp_defender = aliased(Champion)
reg_season = aliased(Season)
imp_season = aliased(Season)


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
                    WarDefensePlacement.is_fight_not_done.is_(False),
                )
            )
            .options(selectinload(WarDefensePlacement.attacker_champion_user))
        )
        result = await session.exec(stmt)
        placements = result.all()

        for placement in placements:
            attacker_cu: ChampionUser = placement.attacker_champion_user
            record = WarFightRecord(
                war_defense_placement_id=placement.id,
                rank=attacker_cu.rank,
                ascension=attacker_cu.ascension,
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

        await session.commit()

        await session.refresh(war)
        war.snapshotted_at = utcnow()
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
    # Refactor candidate, the worst in the codebase: 27 complexity, 27 branches, 84
    # statements. Filter building and result shaping are two jobs in one function.
    async def get_fight_records(  # noqa: C901, PLR0912, PLR0915
        cls,
        session: SessionDep,
        accessible_alliance_ids: list[uuid.UUID],
        source: FightRecordSource = FightRecordSource.NonImported,
        champion_id: uuid.UUID | None = None,
        defender_champion_id: uuid.UUID | None = None,
        node_number: int | None = None,
        tier: int | None = None,
        season_selector: SeasonSelectorType | None = None,
        season_id: uuid.UUID | None = None,
        alliance_id: uuid.UUID | None = None,
        battlegroup: int | None = None,
        game_account_pseudo: str | None = None,
        planning_error_only: bool | None = None,
        page: int = 1,
        size: int = 20,
        sort_by: str = "created_at",
        sort_order: str = "desc",
    ) -> PaginatedFightRecordsResponse:
        if not accessible_alliance_ids:
            return PaginatedFightRecordsResponse(items=[], total=0, page=page, size=size, pages=1)

        include_reg = source in (FightRecordSource.NonImported, FightRecordSource.All)
        include_imp = source in (FightRecordSource.Imported, FightRecordSource.All)

        sub_queries = []

        if include_reg:
            reg_conds = [War.alliance_id.in_(accessible_alliance_ids)]
            if champion_id:
                reg_conds.append(ChampionUser.champion_id == champion_id)
            if defender_champion_id:
                reg_conds.append(WarDefensePlacement.champion_id == defender_champion_id)
            if node_number is not None:
                reg_conds.append(WarDefensePlacement.node_number == node_number)
            if tier is not None:
                reg_conds.append(War.tier == tier)
            if battlegroup is not None:
                reg_conds.append(WarDefensePlacement.battlegroup == battlegroup)
            if planning_error_only is not None:
                reg_conds.append(WarDefensePlacement.is_planning_error == planning_error_only)
            if game_account_pseudo is not None:
                reg_conds.append(GameAccount.game_pseudo.ilike(f"%{game_account_pseudo}%"))
            if alliance_id:
                reg_conds.append(War.alliance_id == alliance_id)
            reg_conds.extend(cls._season_conditions(War, season_selector, season_id))

            reg_sub = (
                join_fight_context(
                    select(
                        WarFightRecord.id.label("id"),
                        War.alliance_id.label("alliance_id"),
                        War.season_id.label("season_id"),
                        reg_season.number.label("season_number"),
                        WarDefensePlacement.node_number.label("node_number"),
                        ChampionUser.champion_id.label("champion_id"),
                        WarDefensePlacement.champion_id.label("defender_champion_id"),
                        WarDefensePlacement.ko_count.label("ko_count"),
                        WarFightRecord.created_at.label("created_at"),
                        War.id.label("war_id"),
                        WarDefensePlacement.battlegroup.label("battlegroup"),
                        War.tier.label("tier"),
                        ChampionUser.stars.label("stars"),
                        WarFightRecord.rank.label("rank"),
                        WarFightRecord.ascension.label("ascension"),
                        ChampionUser.id.label("attacker_champion_user_id"),
                        WarDefensePlacement.stars.label("defender_stars"),
                        WarDefensePlacement.rank.label("defender_rank"),
                        WarDefensePlacement.ascension.label("defender_ascension"),
                        WarDefensePlacement.is_planning_error.label("is_planning_error"),
                        WarDefensePlacement.assist_champion_user_id.isnot(None).label("assisted"),
                        WarDefensePlacement.war_boost.label("war_boost"),
                        WarDefensePlacement.has_defense_boost.label("has_defense_boost"),
                        WarDefensePlacement.has_power_boost.label("has_power_boost"),
                        WarDefensePlacement.has_specials_boost.label("has_specials_boost"),
                        literal(False).label("is_imported"),
                        Alliance.name.label("alliance_name"),
                        Alliance.tag.label("alliance_tag"),
                        reg_attacker.name.label("champion_name"),
                        reg_attacker.champion_class.label("champion_class"),
                        reg_attacker.image_url.label("image_url"),
                        reg_defender.name.label("defender_champion_name"),
                        reg_defender.champion_class.label("defender_champion_class"),
                        reg_defender.image_url.label("defender_image_url"),
                        GameAccount.game_pseudo.label("game_account_pseudo"),
                    )
                )
                .join(Alliance, War.alliance_id == Alliance.id)
                .join(reg_attacker, ChampionUser.champion_id == reg_attacker.id)
                .join(reg_defender, WarDefensePlacement.champion_id == reg_defender.id)
                .join(GameAccount, ChampionUser.game_account_id == GameAccount.id)
                .outerjoin(reg_season, War.season_id == reg_season.id)
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
                    imp_season.number.label("season_number"),
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
                    null().label("attacker_champion_user_id"),
                    null().label("defender_stars"),
                    null().label("defender_rank"),
                    null().label("defender_ascension"),
                    literal(False).label("is_planning_error"),
                    literal(False).label("assisted"),
                    # Imported fights predate Mawster: nothing recorded which boosts were used.
                    literal(None).label("war_boost"),
                    literal(False).label("has_defense_boost"),
                    literal(False).label("has_power_boost"),
                    literal(False).label("has_specials_boost"),
                    literal(True).label("is_imported"),
                    Alliance.name.label("alliance_name"),
                    Alliance.tag.label("alliance_tag"),
                    imp_attacker.name.label("champion_name"),
                    imp_attacker.champion_class.label("champion_class"),
                    imp_attacker.image_url.label("image_url"),
                    imp_defender.name.label("defender_champion_name"),
                    imp_defender.champion_class.label("defender_champion_class"),
                    imp_defender.image_url.label("defender_image_url"),
                    null().label("game_account_pseudo"),
                )
                .join(Alliance, WarFightRecordImport.alliance_id == Alliance.id)
                .join(imp_attacker, WarFightRecordImport.champion_id == imp_attacker.id)
                .join(imp_defender, WarFightRecordImport.defender_champion_id == imp_defender.id)
                .outerjoin(imp_season, WarFightRecordImport.season_id == imp_season.id)
                .where(and_(*imp_conds))
            )
            sub_queries.append(imp_sub)

        if not sub_queries:
            return PaginatedFightRecordsResponse(items=[], total=0, page=page, size=size, pages=1)

        base = (union_all(*sub_queries) if len(sub_queries) > 1 else sub_queries[0]).subquery()

        total = (await session.exec(select(func.count()).select_from(base))).one()

        # SORT — all labeled columns are directly accessible on the subquery
        sort_col_map = {
            "ko_count": base.c.ko_count,
            "tier": base.c.tier,
            "node_number": base.c.node_number,
            "battlegroup": base.c.battlegroup,
            "created_at": base.c.created_at,
            "season_number": base.c.season_number,
            "champion_name": base.c.champion_name,
            "defender_champion_name": base.c.defender_champion_name,
            "alliance_name": base.c.alliance_name,
        }
        sort_col = sort_col_map.get(sort_by, base.c.created_at)
        sort_expr = sort_col.desc() if sort_order == "desc" else sort_col.asc()

        rows = (
            (
                await session.exec(
                    select(*base.c).order_by(sort_expr).offset((page - 1) * size).limit(size)
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
                alliance_tag=row["alliance_tag"],
                season_id=row["season_id"],
                season_number=row["season_number"],
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
                defender_champion_id=row["defender_champion_id"],
                defender_champion_name=row["defender_champion_name"],
                defender_champion_class=row["defender_champion_class"],
                defender_image_url=row["defender_image_url"],
                defender_stars=row["defender_stars"],
                defender_rank=row["defender_rank"],
                defender_ascension=row["defender_ascension"],
                ko_count=row["ko_count"],
                is_planning_error=bool(row["is_planning_error"]),
                assisted=bool(row["assisted"]),
                war_boost=row["war_boost"],
                has_defense_boost=bool(row["has_defense_boost"]),
                has_power_boost=bool(row["has_power_boost"]),
                has_specials_boost=bool(row["has_specials_boost"]),
                synergies=[],
                prefights=[],
                created_at=row["created_at"],
            )
            for row in rows
        ]

        attacker_by_record = {
            row["id"]: row["attacker_champion_user_id"] for row in rows if not row["is_imported"]
        }
        regular = [item for item in items if not item.is_imported]
        await cls._attach_saga_roles(session, regular)
        await cls._attach_team(session, regular, attacker_by_record)

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
                pseudo_by_account = dict(editor_accounts)
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

    @classmethod
    async def _attach_saga_roles(
        cls, session: SessionDep, items: list[WarFightRecordResponse]
    ) -> None:
        """Saga roles are a Season setting, so an admin correction reaches past fights."""
        roles_by_season = {
            season_id: await SagaService.get_roles_for_season(session, season_id)
            for season_id in {item.season_id for item in items if item.season_id}
        }
        for item in items:
            roles = roles_by_season.get(item.season_id, {})
            item.is_saga_attacker = roles.get(item.champion_id, (False, False))[0]
            item.defender_is_saga_defender = roles.get(item.defender_champion_id, (False, False))[1]

    @classmethod
    async def _attach_team(
        cls,
        session: SessionDep,
        items: list[WarFightRecordResponse],
        attacker_by_record: dict[uuid.UUID, uuid.UUID],
    ) -> None:
        if not items:
            return
        war_ids = {item.war_id for item in items}
        prefights = (
            await session.exec(
                select(WarPrefightAttacker)
                .where(WarPrefightAttacker.war_id.in_(war_ids))
                .options(
                    selectinload(WarPrefightAttacker.champion_user).selectinload(
                        ChampionUser.champion
                    )
                )
            )
        ).all()
        synergies = (
            await session.exec(
                select(WarSynergyAttacker)
                .where(WarSynergyAttacker.war_id.in_(war_ids))
                .options(
                    selectinload(WarSynergyAttacker.champion_user).selectinload(
                        ChampionUser.champion
                    )
                )
            )
        ).all()
        prefights_by_node = defaultdict(list)
        for pf in prefights:
            prefights_by_node[(pf.war_id, pf.battlegroup, pf.target_node_number)].append(pf)
        synergies_by_target = defaultdict(list)
        for syn in synergies:
            synergies_by_target[(syn.war_id, syn.battlegroup, syn.target_champion_user_id)].append(
                syn
            )
        for item in items:
            node = (item.war_id, item.battlegroup, item.node_number)
            target = (item.war_id, item.battlegroup, attacker_by_record[item.id])
            item.prefights = [
                WarFightPrefightResponse.model_validate(pf) for pf in prefights_by_node[node]
            ]
            item.synergies = [
                WarFightSynergyResponse.model_validate(syn) for syn in synergies_by_target[target]
            ]

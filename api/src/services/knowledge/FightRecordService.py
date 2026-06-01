import math
import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import aliased, selectinload
from sqlmodel import and_, select
from starlette import status

if TYPE_CHECKING:
    from src.dto.admin.dto_fight_record import PaginatedFightRecordsResponse

from src.enums.SeasonSelectorType import SeasonSelectorType
from src.models.Alliance import Alliance
from src.models.AllianceVisitor import AllianceVisitor
from src.models.Champion import Champion
from src.models.ChampionUser import ChampionUser
from src.models.GameAccount import GameAccount
from src.models.Season import Season
from src.models.War import War
from src.models.WarDefensePlacement import WarDefensePlacement
from src.models.WarFightPrefight import WarFightPrefight
from src.models.WarFightRecord import WarFightRecord
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
    async def _get_imported_records(
        cls,
        session: SessionDep,
        accessible_alliance_ids: list[uuid.UUID],
        champion_id: Optional[uuid.UUID] = None,
        defender_champion_id: Optional[uuid.UUID] = None,
        node_number: Optional[int] = None,
        season_id: Optional[uuid.UUID] = None,
        alliance_id: Optional[uuid.UUID] = None,
        page: int = 1,
        size: int = 20,
    ) -> "PaginatedFightRecordsResponse":
        from src.dto.admin.dto_fight_record import (
            PaginatedFightRecordsResponse,
            WarFightRecordResponse,
        )
        from src.models.WarFightRecordImport import WarFightRecordImport

        conditions = [WarFightRecordImport.alliance_id.in_(accessible_alliance_ids)]
        if champion_id:
            conditions.append(WarFightRecordImport.champion_id == champion_id)
        if defender_champion_id:
            conditions.append(WarFightRecordImport.defender_champion_id == defender_champion_id)
        if node_number:
            conditions.append(WarFightRecordImport.node_number == node_number)
        if season_id:
            conditions.append(WarFightRecordImport.season_id == season_id)
        if alliance_id:
            conditions.append(WarFightRecordImport.alliance_id == alliance_id)

        count_stmt = select(func.count()).select_from(WarFightRecordImport).where(and_(*conditions))
        total = (await session.exec(count_stmt)).one()

        stmt = (
            select(WarFightRecordImport)
            .options(
                selectinload(WarFightRecordImport.alliance),
                selectinload(WarFightRecordImport.champion),
                selectinload(WarFightRecordImport.defender_champion),
            )
            .where(and_(*conditions))
            .order_by(WarFightRecordImport.created_at.desc())
            .offset((page - 1) * size)
            .limit(size)
        )
        result = await session.exec(stmt)
        records = result.all()
        items = [WarFightRecordResponse.model_validate(r) for r in records]
        return PaginatedFightRecordsResponse(
            items=items,
            total=total,
            page=page,
            size=size,
            pages=max(1, math.ceil(total / size)),
        )

    @classmethod
    async def _get_all_records(
        cls,
        session: SessionDep,
        accessible_alliance_ids: list[uuid.UUID],
        champion_id: Optional[uuid.UUID] = None,
        defender_champion_id: Optional[uuid.UUID] = None,
        node_number: Optional[int] = None,
        season_id: Optional[uuid.UUID] = None,
        season_selector: Optional[SeasonSelectorType] = None,
        tier: Optional[int] = None,
        battlegroup: Optional[int] = None,
        game_account_pseudo: Optional[str] = None,
        planning_error_only: Optional[bool] = None,
        alliance_id: Optional[uuid.UUID] = None,
        page: int = 1,
        size: int = 20,
    ) -> "PaginatedFightRecordsResponse":
        """Merge WarFightRecord + WarFightRecordImport, sort by created_at desc, paginate in Python."""
        from datetime import datetime as dt
        from src.dto.admin.dto_fight_record import (
            PaginatedFightRecordsResponse,
            WarFightRecordResponse,
        )
        from src.models.WarFightRecordImport import WarFightRecordImport

        # --- Regular records ---
        reg_conditions = [WarFightRecord.alliance_id.in_(accessible_alliance_ids)]
        if champion_id:
            reg_conditions.append(WarFightRecord.champion_id == champion_id)
        if defender_champion_id:
            reg_conditions.append(WarFightRecord.defender_champion_id == defender_champion_id)
        if node_number:
            reg_conditions.append(WarFightRecord.node_number == node_number)
        if tier is not None:
            reg_conditions.append(WarFightRecord.tier == tier)
        if battlegroup is not None:
            reg_conditions.append(WarFightRecord.battlegroup == battlegroup)
        if planning_error_only is not None:
            reg_conditions.append(WarFightRecord.is_planning_error == planning_error_only)
        if season_selector == SeasonSelectorType.AllSeasons:
            reg_conditions.append(WarFightRecord.season_id.isnot(None))
        elif season_selector == SeasonSelectorType.OffSeason:
            reg_conditions.append(WarFightRecord.season_id.is_(None))
        elif season_selector == SeasonSelectorType.Current:
            active_subq = select(Season.id).where(Season.is_active == True)  # noqa: E712
            reg_conditions.append(WarFightRecord.season_id.in_(active_subq))
        elif season_selector == SeasonSelectorType.Specific and season_id is not None:
            reg_conditions.append(WarFightRecord.season_id == season_id)
        elif season_id:
            reg_conditions.append(WarFightRecord.season_id == season_id)
        if alliance_id:
            reg_conditions.append(WarFightRecord.alliance_id == alliance_id)
        if game_account_pseudo is not None:
            reg_conditions.append(GameAccount.game_pseudo.ilike(f"%{game_account_pseudo}%"))

        reg_stmt = (
            select(WarFightRecord)
            .options(
                selectinload(WarFightRecord.war),
                selectinload(WarFightRecord.alliance),
                selectinload(WarFightRecord.champion),
                selectinload(WarFightRecord.defender_champion),
                selectinload(WarFightRecord.game_account),
                selectinload(WarFightRecord.synergies).selectinload(WarFightSynergy.champion),
                selectinload(WarFightRecord.prefights).selectinload(WarFightPrefight.champion),
            )
            .where(and_(*reg_conditions))
        )
        if game_account_pseudo is not None:
            reg_stmt = reg_stmt.join(GameAccount, WarFightRecord.game_account_id == GameAccount.id)
        reg_records = (await session.exec(reg_stmt)).all()

        # --- Imported records ---
        imp_conditions = [WarFightRecordImport.alliance_id.in_(accessible_alliance_ids)]
        if champion_id:
            imp_conditions.append(WarFightRecordImport.champion_id == champion_id)
        if defender_champion_id:
            imp_conditions.append(WarFightRecordImport.defender_champion_id == defender_champion_id)
        if node_number:
            imp_conditions.append(WarFightRecordImport.node_number == node_number)
        if season_selector == SeasonSelectorType.AllSeasons:
            imp_conditions.append(WarFightRecordImport.season_id.isnot(None))
        elif season_selector == SeasonSelectorType.OffSeason:
            imp_conditions.append(WarFightRecordImport.season_id.is_(None))
        elif season_selector == SeasonSelectorType.Current:
            active_subq = select(Season.id).where(Season.is_active == True)  # noqa: E712
            imp_conditions.append(WarFightRecordImport.season_id.in_(active_subq))
        elif season_selector == SeasonSelectorType.Specific and season_id is not None:
            imp_conditions.append(WarFightRecordImport.season_id == season_id)
        elif season_id:
            imp_conditions.append(WarFightRecordImport.season_id == season_id)
        if alliance_id:
            imp_conditions.append(WarFightRecordImport.alliance_id == alliance_id)

        imp_stmt = (
            select(WarFightRecordImport)
            .options(
                selectinload(WarFightRecordImport.alliance),
                selectinload(WarFightRecordImport.champion),
                selectinload(WarFightRecordImport.defender_champion),
            )
            .where(and_(*imp_conditions))
        )
        imp_records = (await session.exec(imp_stmt)).all()

        all_items = [WarFightRecordResponse.model_validate(r) for r in reg_records] + [
            WarFightRecordResponse.model_validate(r) for r in imp_records
        ]
        all_items.sort(key=lambda x: x.created_at or dt.min, reverse=True)

        total = len(all_items)
        offset = (page - 1) * size
        return PaginatedFightRecordsResponse(
            items=all_items[offset : offset + size],
            total=total,
            page=page,
            size=size,
            pages=max(1, math.ceil(total / size)),
        )

    @classmethod
    async def get_fight_records(
        cls,
        session: SessionDep,
        accessible_alliance_ids: list[uuid.UUID],
        source: str = "non_imported",
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
    ) -> "PaginatedFightRecordsResponse":
        from src.dto.admin.dto_fight_record import (
            PaginatedFightRecordsResponse,
            WarFightRecordResponse,
        )

        if not accessible_alliance_ids:
            return PaginatedFightRecordsResponse(items=[], total=0, page=page, size=size, pages=1)

        if source == "imported":
            return await cls._get_imported_records(
                session,
                accessible_alliance_ids,
                champion_id=champion_id,
                defender_champion_id=defender_champion_id,
                node_number=node_number,
                season_id=season_id,
                alliance_id=alliance_id,
                page=page,
                size=size,
            )
        if source == "all":
            return await cls._get_all_records(
                session,
                accessible_alliance_ids,
                champion_id=champion_id,
                defender_champion_id=defender_champion_id,
                node_number=node_number,
                season_id=season_id,
                season_selector=season_selector,
                tier=tier,
                battlegroup=battlegroup,
                game_account_pseudo=game_account_pseudo,
                planning_error_only=planning_error_only,
                alliance_id=alliance_id,
                page=page,
                size=size,
            )
        # source == "non_imported" → existing logic continues below

        # Build conditions list for reuse in count query
        conditions = []
        conditions.append(WarFightRecord.alliance_id.in_(accessible_alliance_ids))
        if champion_id is not None:
            conditions.append(WarFightRecord.champion_id == champion_id)
        if defender_champion_id is not None:
            conditions.append(WarFightRecord.defender_champion_id == defender_champion_id)
        if node_number is not None:
            conditions.append(WarFightRecord.node_number == node_number)
        if tier is not None:
            conditions.append(WarFightRecord.tier == tier)
        if season_selector == SeasonSelectorType.AllSeasons:
            conditions.append(WarFightRecord.season_id.isnot(None))
        elif season_selector == SeasonSelectorType.OffSeason:
            conditions.append(WarFightRecord.season_id.is_(None))
        elif season_selector == SeasonSelectorType.Current:
            active_subq = select(Season.id).where(Season.is_active == True)  # noqa: E712
            conditions.append(WarFightRecord.season_id.in_(active_subq))
        elif season_selector == SeasonSelectorType.Specific and season_id is not None:
            conditions.append(WarFightRecord.season_id == season_id)
        if alliance_id is not None:
            conditions.append(WarFightRecord.alliance_id == alliance_id)
        if battlegroup is not None:
            conditions.append(WarFightRecord.battlegroup == battlegroup)
        if game_account_pseudo is not None:
            conditions.append(GameAccount.game_pseudo.ilike(f"%{game_account_pseudo}%"))
        if planning_error_only is not None:
            conditions.append(WarFightRecord.is_planning_error == planning_error_only)

        # Count query
        count_stmt = select(func.count()).select_from(WarFightRecord)
        if game_account_pseudo is not None:
            count_stmt = count_stmt.join(
                GameAccount, WarFightRecord.game_account_id == GameAccount.id
            )
        if conditions:
            count_stmt = count_stmt.where(and_(*conditions))
        total = (await session.exec(count_stmt)).one()

        # Build sort column
        AttackerChampion = aliased(Champion)
        DefenderChampion = aliased(Champion)

        sort_col_map = {
            "ko_count": WarFightRecord.ko_count,
            "tier": WarFightRecord.tier,
            "node_number": WarFightRecord.node_number,
            "battlegroup": WarFightRecord.battlegroup,
            "created_at": WarFightRecord.created_at,
        }

        needs_attacker_join = sort_by == "champion_name"
        needs_defender_join = sort_by == "defender_champion_name"
        needs_alliance_join = sort_by == "alliance_name"

        # Main query
        stmt = select(WarFightRecord).options(
            selectinload(WarFightRecord.war),
            selectinload(WarFightRecord.alliance),
            selectinload(WarFightRecord.champion),
            selectinload(WarFightRecord.defender_champion),
            selectinload(WarFightRecord.game_account),
            selectinload(WarFightRecord.synergies).selectinload(WarFightSynergy.champion),
            selectinload(WarFightRecord.prefights).selectinload(WarFightPrefight.champion),
        )
        if game_account_pseudo is not None:
            stmt = stmt.join(GameAccount, WarFightRecord.game_account_id == GameAccount.id)
        if conditions:
            stmt = stmt.where(and_(*conditions))

        if needs_attacker_join:
            stmt = stmt.join(AttackerChampion, WarFightRecord.champion_id == AttackerChampion.id)
            raw_col = AttackerChampion.name
        elif needs_defender_join:
            stmt = stmt.join(
                DefenderChampion, WarFightRecord.defender_champion_id == DefenderChampion.id
            )
            raw_col = DefenderChampion.name
        elif needs_alliance_join:
            stmt = stmt.join(Alliance, WarFightRecord.alliance_id == Alliance.id)
            raw_col = Alliance.name
        else:
            raw_col = sort_col_map.get(sort_by, WarFightRecord.created_at)

        sort_col = raw_col.desc() if sort_order == "desc" else raw_col.asc()
        stmt = stmt.order_by(sort_col).offset((page - 1) * size).limit(size)

        result = await session.exec(stmt)
        records = result.all()

        items = [WarFightRecordResponse.model_validate(r) for r in records]
        return PaginatedFightRecordsResponse(
            items=items,
            total=total,
            page=page,
            size=size,
            pages=max(1, math.ceil(total / size)),
        )

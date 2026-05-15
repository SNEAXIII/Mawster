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

from src.models.Alliance import Alliance
from src.models.Champion import Champion
from src.models.ChampionUser import ChampionUser
from src.models.GameAccount import GameAccount
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
        result = await session.exec(
            select(GameAccount).where(
                and_(
                    GameAccount.user_id == user_id,
                    GameAccount.alliance_id.isnot(None),
                )
            )
        )
        if result.first() is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User must belong to an alliance",
            )

    @classmethod
    async def get_fight_records(
        cls,
        session: SessionDep,
        champion_id: Optional[uuid.UUID] = None,
        defender_champion_id: Optional[uuid.UUID] = None,
        node_number: Optional[int] = None,
        tier: Optional[int] = None,
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

        # Build conditions list for reuse in count query
        conditions = []
        if champion_id is not None:
            conditions.append(WarFightRecord.champion_id == champion_id)
        if defender_champion_id is not None:
            conditions.append(WarFightRecord.defender_champion_id == defender_champion_id)
        if node_number is not None:
            conditions.append(WarFightRecord.node_number == node_number)
        if tier is not None:
            conditions.append(WarFightRecord.tier == tier)
        if season_id is not None:
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

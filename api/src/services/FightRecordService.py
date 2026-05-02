import uuid
from datetime import datetime
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import selectinload
from sqlmodel import and_, select
from starlette import status

from src.models.Alliance import Alliance
from src.models.Champion import Champion
from src.models.ChampionUser import ChampionUser
from src.models.GameAccount import GameAccount
from src.models.War import War, WarStatus
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
                .options(
                    selectinload(WarPrefightAttacker.champion_user)
                )
            )
            pf_result = await session.exec(pf_stmt)
            for pf in pf_result.all():
                pf_cu: ChampionUser = pf.champion_user
                session.add(WarFightPrefight(
                    war_fight_record_id=record.id,
                    champion_id=pf_cu.champion_id,
                    stars=pf_cu.stars,
                    ascension=pf_cu.ascension,
                ))

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
                .options(
                    selectinload(WarSynergyAttacker.champion_user)
                )
            )
            syn_result = await session.exec(syn_stmt)
            for syn in syn_result.all():
                syn_cu: ChampionUser = syn.champion_user
                session.add(WarFightSynergy(
                    war_fight_record_id=record.id,
                    champion_id=syn_cu.champion_id,
                    stars=syn_cu.stars,
                    ascension=syn_cu.ascension,
                ))

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
    ) -> list[WarFightRecord]:
        stmt = (
            select(WarFightRecord)
            .options(
                selectinload(WarFightRecord.champion),
                selectinload(WarFightRecord.defender_champion),
                selectinload(WarFightRecord.game_account),
                selectinload(WarFightRecord.synergies).selectinload(WarFightSynergy.champion),
                selectinload(WarFightRecord.prefights).selectinload(WarFightPrefight.champion),
            )
        )
        if champion_id is not None:
            stmt = stmt.where(WarFightRecord.champion_id == champion_id)
        if defender_champion_id is not None:
            stmt = stmt.where(WarFightRecord.defender_champion_id == defender_champion_id)
        if node_number is not None:
            stmt = stmt.where(WarFightRecord.node_number == node_number)
        if tier is not None:
            stmt = stmt.where(WarFightRecord.tier == tier)
        if season_id is not None:
            stmt = stmt.where(WarFightRecord.season_id == season_id)
        if alliance_id is not None:
            stmt = stmt.where(WarFightRecord.alliance_id == alliance_id)
        if battlegroup is not None:
            stmt = stmt.where(WarFightRecord.battlegroup == battlegroup)

        result = await session.exec(stmt)
        return result.all()

    @classmethod
    async def force_snapshot_all(cls, session: SessionDep) -> dict:
        """Snapshot all ended wars, counting already-snapshotted ones as skipped."""
        stmt = select(War).where(War.status == WarStatus.ended)
        result = await session.exec(stmt)
        wars = result.all()

        snapshotted = 0
        skipped = 0
        for war in wars:
            if war.snapshotted_at is not None:
                skipped += 1
            else:
                await cls.snapshot_war(session, war)
                snapshotted += 1

        return {"snapshotted": snapshotted, "skipped": skipped}

    @classmethod
    async def get_snapshot_stats(cls, session: SessionDep) -> list:
        """Returns per-alliance count of snapshotted wars."""
        stmt = (
            select(
                Alliance.id.label("alliance_id"),
                Alliance.name.label("alliance_name"),
                func.count(War.id).label("war_count"),
            )
            .join(War, War.alliance_id == Alliance.id)
            .where(War.snapshotted_at.isnot(None))
            .group_by(Alliance.id, Alliance.name)
        )
        result = await session.exec(stmt)
        rows = result.all()
        return [
            {"alliance_id": row.alliance_id, "alliance_name": row.alliance_name, "war_count": row.war_count}
            for row in rows
        ]

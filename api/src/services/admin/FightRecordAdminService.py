from sqlalchemy import func
from sqlmodel import select

from src.models.Alliance import Alliance
from src.models.War import War, WarStatus
from src.services.knowledge.FightRecordService import FightRecordService
from src.utils.db import SessionDep


class FightRecordAdminService:
    @classmethod
    async def force_snapshot_all(cls, session: SessionDep) -> dict:
        stmt = select(War).where(War.status == WarStatus.ended)
        result = await session.exec(stmt)
        wars = result.all()

        snapshotted = 0
        skipped = 0
        for war in wars:
            if war.snapshotted_at is not None:
                skipped += 1
            else:
                await FightRecordService.snapshot_war(session, war)
                snapshotted += 1

        return {"snapshotted": snapshotted, "skipped": skipped}

    @classmethod
    async def get_snapshot_stats(cls, session: SessionDep) -> list:
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
            {
                "alliance_id": row.alliance_id,
                "alliance_name": row.alliance_name,
                "war_count": row.war_count,
            }
            for row in rows
        ]

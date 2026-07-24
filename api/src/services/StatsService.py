from datetime import timedelta

from sqlalchemy import func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.dto.dto_stats import PublicStatsResponse
from src.models import War, WarFightRecord
from src.models.Base import utcnow


class StatsService:
    @staticmethod
    async def get_public_stats(session: AsyncSession) -> PublicStatsResponse:
        cutoff = utcnow() - timedelta(days=30)
        active_alliances = (
            await session.execute(
                select(func.count(func.distinct(War.alliance_id))).where(War.created_at >= cutoff)
            )
        ).scalar_one()
        participating_players = (
            await session.execute(select(func.count(func.distinct(WarFightRecord.game_account_id))))
        ).scalar_one()
        knowledge_base_fights = (
            await session.execute(select(func.count(WarFightRecord.id)))
        ).scalar_one()
        wars_recorded = (await session.execute(select(func.count(War.id)))).scalar_one()
        return PublicStatsResponse(
            active_alliances=active_alliances,
            participating_players=participating_players,
            knowledge_base_fights=knowledge_base_fights,
            wars_recorded=wars_recorded,
        )

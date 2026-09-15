from datetime import timedelta

from sqlalchemy import func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.dto.dto_stats import PublicStatsResponse
from src.models import ChampionUser, War, WarFightRecord
from src.models.Base import utcnow
from src.services.knowledge._fight_context import join_fight_context


class StatsService:
    @staticmethod
    async def get_public_stats(session: AsyncSession) -> PublicStatsResponse:
        cutoff = utcnow() - timedelta(days=30)
        active_alliances = (
            await session.exec(
                select(func.count(func.distinct(War.alliance_id))).where(War.created_at >= cutoff)
            )
        ).scalar_one()
        participating_players = (
            await session.exec(
                join_fight_context(select(func.count(func.distinct(ChampionUser.game_account_id))))
            )
        ).scalar_one()
        knowledge_base_fights = (
            await session.exec(join_fight_context(select(func.count(WarFightRecord.id))))
        ).scalar_one()
        wars_recorded = (await session.exec(select(func.count(War.id)))).scalar_one()
        return PublicStatsResponse(
            active_alliances=active_alliances,
            participating_players=participating_players,
            knowledge_base_fights=knowledge_base_fights,
            wars_recorded=wars_recorded,
        )

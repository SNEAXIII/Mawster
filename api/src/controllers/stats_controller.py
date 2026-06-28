from fastapi import APIRouter

from src.dto.dto_stats import PublicStatsResponse
from src.services.StatsService import StatsService
from src.utils.db import SessionDep

stats_controller = APIRouter(
    prefix="/stats",
    tags=["Stats"],
)


@stats_controller.get("/public", response_model=PublicStatsResponse)
async def get_public_stats(session: SessionDep):
    """Public, unauthenticated aggregate counts for the landing page."""
    return await StatsService.get_public_stats(session)

import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query

from src.dto.dto_statistic import ChampionUsageResponse, PlayerSeasonStatsResponse
from src.models import User
from src.utils.db import SessionDep
from src.services.StatisticService import StatisticService
from src.services.AuthService import AuthService

statistics_controller = APIRouter(
    prefix="/statistics",
    tags=["Statistics"],
    dependencies=[
        Depends(AuthService.get_current_user_in_jwt),
    ],
)


@statistics_controller.get(
    "/current_season/{alliance_id}",
    response_model=list[PlayerSeasonStatsResponse],
)
async def get_current_season_statistics(
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
    alliance_id: uuid.UUID,
):
    """Get the current season statistics."""
    return await StatisticService.get_active_season_statistics(session, current_user, alliance_id)


@statistics_controller.get(
    "/champion-usage/{alliance_id}",
    response_model=list[ChampionUsageResponse],
)
async def get_champion_usage(
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
    alliance_id: uuid.UUID,
    game_account_id: Optional[uuid.UUID] = Query(default=None),
    war_id: Optional[uuid.UUID] = Query(default=None),
    alliance_group: Optional[int] = Query(default=None),
    deathless: Optional[bool] = Query(default=None),
    perspective: str = Query(default="attacker", pattern="^(attacker|defender)$"),
):
    """Get champion usage aggregated for an alliance in the active season."""
    return await StatisticService.get_champion_usage(
        session,
        current_user,
        alliance_id,
        game_account_id,
        war_id,
        alliance_group,
        deathless,
        perspective,
    )

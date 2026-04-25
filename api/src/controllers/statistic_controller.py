import uuid
from typing import Annotated

from fastapi import APIRouter, Depends

from src.dto.dto_statistic import PlayerSeasonStatsResponse
from src.models import User
from src.utils.db import SessionDep
from src.services.StatisticService import StatisticService
from src.services.AuthService import AuthService

statistics_controller = APIRouter(
    prefix="/statistics",
    tags=["Statistics"],
    dependencies=[
        Depends(AuthService.is_logged_as_user),
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

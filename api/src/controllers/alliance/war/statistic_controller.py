import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query

from src.dto.alliance.war.dto_statistic import ChampionUsageResponse, PlayerSeasonStatsResponse
from src.dto.player.dto_player_stats import PlayerStatsResponse, PlayerSeasonOption
from src.models import User
from src.utils.db import SessionDep
from src.services.alliance.war.StatisticService import StatisticService
from src.services.PlayerStatsService import PlayerStatsService
from src.services.auth.AuthService import AuthService

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
    return await StatisticService.get_display_season_statistics(session, current_user, alliance_id)


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


@statistics_controller.get("/player/{game_account_id}", response_model=PlayerStatsResponse)
async def get_player_stats(
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
    game_account_id: uuid.UUID,
    season_id: Optional[uuid.UUID] = Query(default=None),
):
    """Composite personal stats for one game account (owner only)."""
    return await PlayerStatsService.get_player_stats(
        session, current_user, game_account_id, season_id
    )


@statistics_controller.get(
    "/player/{game_account_id}/champion-usage",
    response_model=list[ChampionUsageResponse],
)
async def get_player_champion_usage(
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
    game_account_id: uuid.UUID,
    season_id: Optional[uuid.UUID] = Query(default=None),
    deathless: Optional[bool] = Query(default=None),
    perspective: str = Query(default="attacker", pattern="^(attacker|defender)$"),
):
    """Champion usage for one game account (owner only)."""
    return await PlayerStatsService.get_player_champion_usage(
        session, current_user, game_account_id, season_id, deathless, perspective
    )


@statistics_controller.get(
    "/player/{game_account_id}/seasons",
    response_model=list[PlayerSeasonOption],
)
async def get_player_seasons(
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
    game_account_id: uuid.UUID,
):
    """Seasons the game account participated in (owner only)."""
    return await PlayerStatsService.get_player_seasons(session, current_user, game_account_id)

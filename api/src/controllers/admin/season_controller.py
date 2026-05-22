from typing import Annotated, Optional

from fastapi import APIRouter, Depends
from starlette import status

from src.dto.admin.dto_season import SeasonCreateRequest, SeasonResponse
from src.models import User
from src.services.auth.AuthService import AuthService
from src.services.admin.SeasonService import SeasonService
from src.services.knowledge.FightRecordService import FightRecordService
from src.utils.db import SessionDep

season_admin_controller = APIRouter(
    prefix="/admin/seasons",
    tags=["Season"],
    dependencies=[Depends(AuthService.require_admin)],
)

season_public_controller = APIRouter(
    prefix="/seasons",
    tags=["Season"],
    dependencies=[Depends(AuthService.get_current_user_in_jwt)],
)


@season_admin_controller.post(
    "", response_model=SeasonResponse, status_code=status.HTTP_201_CREATED
)
async def create_season(body: SeasonCreateRequest, session: SessionDep):
    """Create a new season. Admin only."""
    return await SeasonService.create_season(session, body.number, body.is_big_thing)


@season_admin_controller.get("", response_model=list[SeasonResponse])
async def list_seasons(session: SessionDep):
    """List all seasons ordered by number desc. Admin only."""
    return await SeasonService.get_all_seasons(session)


@season_public_controller.get("", response_model=list[SeasonResponse])
async def list_seasons_public(
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """List all seasons ordered by number desc."""
    await FightRecordService.assert_user_in_alliance(session, current_user.id)
    return await SeasonService.get_all_seasons(session)


@season_public_controller.get("/current", response_model=Optional[SeasonResponse])
async def get_current_season(session: SessionDep):
    """Return the active season, or null if off-season."""
    return await SeasonService.get_active_season(session)

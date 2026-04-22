import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends
from starlette import status

from src.dto.dto_season import SeasonCreateRequest, SeasonResponse
from src.models import User
from src.services.AuthService import AuthService
from src.services.SeasonService import SeasonService
from src.utils.db import SessionDep
from src.utils.logging_config import audit_log

season_admin_controller = APIRouter(
    prefix="/admin/seasons",
    tags=["Season"],
    dependencies=[
        Depends(AuthService.is_logged_as_admin),
    ],
)

season_public_controller = APIRouter(
    prefix="/seasons",
    tags=["Season"],
    dependencies=[
        Depends(AuthService.is_logged_as_user),
    ],
)


@season_admin_controller.post(
    "",
    response_model=SeasonResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_season(body: SeasonCreateRequest, session: SessionDep):
    """Create a new season. Admin only."""
    return await SeasonService.create_season(session, body.number)


@season_admin_controller.get("", response_model=list[SeasonResponse])
async def list_seasons(session: SessionDep):
    """List all seasons ordered by number desc. Admin only."""
    return await SeasonService.get_all_seasons(session)


@season_admin_controller.patch("/{season_id}/activate", response_model=SeasonResponse)
async def activate_season(
    season_id: uuid.UUID,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Activate a season (auto-deactivates any currently active season). Admin only."""
    result = await SeasonService.activate_season(session, season_id)
    audit_log(
        "admin.activate_season", user_id=str(current_user.id), detail=f"season_id={season_id}"
    )
    return result


@season_admin_controller.patch("/{season_id}/deactivate", response_model=SeasonResponse)
async def deactivate_season(
    season_id: uuid.UUID,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Deactivate a season (moves to off-season). Admin only."""
    result = await SeasonService.deactivate_season(session, season_id)
    audit_log(
        "admin.deactivate_season", user_id=str(current_user.id), detail=f"season_id={season_id}"
    )
    return result


@season_public_controller.get("/current", response_model=Optional[SeasonResponse])
async def get_current_season(session: SessionDep):
    """Return the active season, or null if off-season."""
    return await SeasonService.get_active_season(session)

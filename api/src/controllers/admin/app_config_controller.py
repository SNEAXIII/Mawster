from fastapi import APIRouter, Depends, HTTPException
from starlette import status

from src.dto.admin.dto_app_config import (
    AppConfigResponse,
    SetCurrentSeasonRequest,
    SetOffSeasonBigThingRequest,
)
from src.models.Season import Season
from src.services.admin.AppConfigService import AppConfigService
from src.services.auth.AuthService import AuthService
from src.utils.db import SessionDep

app_config_controller = APIRouter(
    prefix="/admin/config",
    tags=["Config"],
    dependencies=[Depends(AuthService.require_admin)],
)


async def _build_response(session: SessionDep) -> AppConfigResponse:
    return AppConfigResponse(
        current_season_id=await AppConfigService.get_current_season_id(session),
        off_season_big_thing=await AppConfigService.get_off_season_big_thing(session),
    )


@app_config_controller.get("", response_model=AppConfigResponse)
async def get_config(session: SessionDep):
    """Return current global config."""
    return await _build_response(session)


@app_config_controller.put("/current-season", response_model=AppConfigResponse)
async def set_current_season(body: SetCurrentSeasonRequest, session: SessionDep):
    """Set the active season (null = off-season)."""
    if body.season_id is not None:
        season = await session.get(Season, body.season_id)
        if season is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Season not found")
    await AppConfigService.set_current_season_id(session, body.season_id)
    return await _build_response(session)


@app_config_controller.put("/off-season-big-thing", response_model=AppConfigResponse)
async def set_off_season_big_thing(body: SetOffSeasonBigThingRequest, session: SessionDep):
    """Toggle Big Thing mode for off-season."""
    await AppConfigService.set_off_season_big_thing(session, body.enabled)
    return await _build_response(session)

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from starlette import status

from src.dto.alliance.war.dto_war import WarCreateRequest, WarEndRequest, WarResponse
from src.models import User
from src.services.alliance.AllianceService import AllianceService
from src.services.auth.AuthService import AuthService
from src.services.alliance.war.WarService import WarService
from src.utils.db import SessionDep

war_core_controller = APIRouter(
    prefix="/alliances/{alliance_id}/wars",
    tags=["War"],
    dependencies=[Depends(AuthService.get_current_user_in_jwt)],
)


@war_core_controller.post(
    "",
    response_model=WarResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_war(
    alliance_id: uuid.UUID,
    body: WarCreateRequest,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Declare a new war against an opponent. Officers/owner only."""
    account = await AllianceService.assert_officer_or_owner_by_id(
        session, alliance_id, current_user.id
    )
    return await WarService.create_war(
        session, alliance_id, body.opponent_name, account.id, body.banned_champion_ids
    )


@war_core_controller.get(
    "",
    response_model=list[WarResponse],
)
async def list_wars(
    alliance_id: uuid.UUID,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """List all wars for an alliance. All members can view."""
    await AllianceService.require_visitor(session, alliance_id, current_user.id)
    return await WarService.get_wars(session, alliance_id)


@war_core_controller.get(
    "/current",
    response_model=WarResponse,
)
async def get_current_war(
    alliance_id: uuid.UUID,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Get the currently active war for an alliance. All members can view."""
    await AllianceService.require_visitor(session, alliance_id, current_user.id)
    return await WarService.get_current_war(session, alliance_id)


@war_core_controller.post(
    "/{war_id}/end",
    response_model=WarResponse,
)
async def end_war(
    alliance_id: uuid.UUID,
    war_id: uuid.UUID,
    body: WarEndRequest,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Mark a war as ended with result. Officers/owner only."""
    await AllianceService.require_officer(session, alliance_id, current_user.id)
    return await WarService.end_war(session, war_id, alliance_id, body.win, body.elo_change)

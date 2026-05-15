import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from starlette import status

from src.dto.alliance.war.dto_war import (
    WarDefenseSummaryResponse,
    WarPlacementCreateRequest,
    WarPlacementResponse,
)
from src.models import User
from src.services.alliance.AllianceService import AllianceService
from src.services.auth.AuthService import AuthService
from src.services.alliance.war.WarService import WarService
from src.utils.db import SessionDep
from src.utils.path_params import BattlegroupPath
from src.controllers.alliance.war.war_deps import WarDep

war_placement_controller = APIRouter(
    prefix="/alliances/{alliance_id}/wars",
    tags=["War"],
    dependencies=[Depends(AuthService.get_current_user_in_jwt)],
)


@war_placement_controller.get(
    "/{war_id}/bg/{battlegroup}",
    response_model=WarDefenseSummaryResponse,
)
async def get_war_defense(
    alliance_id: uuid.UUID,
    war_id: uuid.UUID,
    battlegroup: BattlegroupPath,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
    war: WarDep,
):
    """Get defense placements for a war battlegroup. All members can view."""
    await AllianceService.require_visitor(session, alliance_id, current_user.id)
    return await WarService.get_war_defense(session, war_id, battlegroup)


@war_placement_controller.post(
    "/{war_id}/bg/{battlegroup}/place",
    response_model=WarPlacementResponse,
    status_code=status.HTTP_201_CREATED,
)
async def place_war_defender(
    alliance_id: uuid.UUID,
    war_id: uuid.UUID,
    battlegroup: BattlegroupPath,
    body: WarPlacementCreateRequest,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
    war: WarDep,
):
    """Place a champion on a war defense node. Officers/owner only."""
    account = await AllianceService.assert_officer_or_owner_by_id(
        session, alliance_id, current_user.id
    )
    return await WarService.place_defender(session, war_id, battlegroup, body, account.id)


@war_placement_controller.delete(
    "/{war_id}/bg/{battlegroup}/node/{node_number}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_war_defender(
    alliance_id: uuid.UUID,
    war_id: uuid.UUID,
    battlegroup: BattlegroupPath,
    node_number: int,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
    war: WarDep,
):
    """Remove a defender from a war node. Officers/owner only."""
    await AllianceService.require_officer(session, alliance_id, current_user.id)
    await WarService.remove_defender(session, war_id, battlegroup, node_number)


@war_placement_controller.delete(
    "/{war_id}/bg/{battlegroup}/clear",
    status_code=status.HTTP_200_OK,
)
async def clear_war_bg(
    alliance_id: uuid.UUID,
    war_id: uuid.UUID,
    battlegroup: BattlegroupPath,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
    war: WarDep,
):
    """Clear all defenders in a war battlegroup. Officers/owner only."""
    await AllianceService.require_officer(session, alliance_id, current_user.id)
    count = await WarService.clear_bg(session, war_id, battlegroup)
    return {"deleted": count}

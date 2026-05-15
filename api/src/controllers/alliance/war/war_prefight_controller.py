import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from starlette import status

from src.dto.alliance.war.dto_war import WarPrefightCreateRequest, WarPrefightResponse
from src.models import User
from src.services.alliance.AllianceService import AllianceService
from src.services.auth.AuthService import AuthService
from src.services.alliance.war.WarService import WarService
from src.utils.db import SessionDep
from src.utils.path_params import BattlegroupPath
from src.controllers.alliance.war.war_deps import WarDep

war_prefight_controller = APIRouter(
    prefix="/alliances/{alliance_id}/wars",
    tags=["War"],
    dependencies=[Depends(AuthService.get_current_user_in_jwt)],
)


@war_prefight_controller.get(
    "/{war_id}/bg/{battlegroup}/prefight",
    response_model=list[WarPrefightResponse],
)
async def get_war_prefight(
    alliance_id: uuid.UUID,
    war_id: uuid.UUID,
    battlegroup: BattlegroupPath,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
    war: WarDep,
):
    """List pre-fight champions for a battlegroup. All members can view."""
    await AllianceService.require_visitor(session, alliance_id, current_user.id)
    return await WarService.get_prefight_attackers(session, war_id, battlegroup)


@war_prefight_controller.post(
    "/{war_id}/bg/{battlegroup}/prefight",
    response_model=WarPrefightResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_war_prefight(
    alliance_id: uuid.UUID,
    war_id: uuid.UUID,
    battlegroup: BattlegroupPath,
    body: WarPrefightCreateRequest,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
    war: WarDep,
):
    """Add a pre-fight champion for a battlegroup. All members can add."""
    await AllianceService.require_member(session, alliance_id, current_user.id)
    return await WarService.add_prefight_attacker(
        session,
        war_id,
        alliance_id,
        battlegroup,
        body.champion_user_id,
        body.target_node_number,
    )


@war_prefight_controller.delete(
    "/{war_id}/bg/{battlegroup}/prefight/{champion_user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_war_prefight(
    alliance_id: uuid.UUID,
    war_id: uuid.UUID,
    battlegroup: BattlegroupPath,
    champion_user_id: uuid.UUID,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
    war: WarDep,
):
    """Remove a pre-fight champion. Any alliance member can remove."""
    await AllianceService.require_member(session, alliance_id, current_user.id)
    await WarService.remove_prefight_attacker(session, war_id, battlegroup, champion_user_id)

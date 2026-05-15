import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from starlette import status

from src.dto.dto_war import WarSynergyCreateRequest, WarSynergyResponse
from src.models import User
from src.services.alliance.AllianceService import AllianceService
from src.services.auth.AuthService import AuthService
from src.services.alliance.war.WarService import WarService
from src.utils.db import SessionDep
from src.utils.path_params import BattlegroupPath
from src.controllers.alliance.war.war_deps import WarDep

war_synergy_controller = APIRouter(
    prefix="/alliances/{alliance_id}/wars",
    tags=["War"],
    dependencies=[Depends(AuthService.get_current_user_in_jwt)],
)


@war_synergy_controller.get(
    "/{war_id}/bg/{battlegroup}/synergy",
    response_model=list[WarSynergyResponse],
)
async def get_war_synergy(
    alliance_id: uuid.UUID,
    war_id: uuid.UUID,
    battlegroup: BattlegroupPath,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
    war: WarDep,
):
    """List synergy champions for a battlegroup. All members can view."""
    await AllianceService.require_visitor(session, alliance_id, current_user.id)
    return await WarService.get_synergy_attackers(session, war_id, battlegroup)


@war_synergy_controller.post(
    "/{war_id}/bg/{battlegroup}/synergy",
    response_model=WarSynergyResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_war_synergy(
    alliance_id: uuid.UUID,
    war_id: uuid.UUID,
    battlegroup: BattlegroupPath,
    body: WarSynergyCreateRequest,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
    war: WarDep,
):
    """Add a synergy champion for a battlegroup. All members can add."""
    await AllianceService.require_member(session, alliance_id, current_user.id)
    return await WarService.add_synergy_attacker(
        session,
        war_id,
        alliance_id,
        battlegroup,
        body.champion_user_id,
        body.target_champion_user_id,
        current_user.id,
    )


@war_synergy_controller.delete(
    "/{war_id}/bg/{battlegroup}/synergy/{champion_user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_war_synergy(
    alliance_id: uuid.UUID,
    war_id: uuid.UUID,
    battlegroup: BattlegroupPath,
    champion_user_id: uuid.UUID,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
    war: WarDep,
):
    """Remove a synergy champion from a battlegroup. All members can remove."""
    await AllianceService.require_member(session, alliance_id, current_user.id)
    await WarService.remove_synergy_attacker(session, war_id, battlegroup, champion_user_id)

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends

from src.dto.alliance.war.dto_war import (
    AvailableAttackerResponse,
    AvailablePrefightAttackerResponse,
    WarAttackerAssignRequest,
    WarKoUpdateRequest,
    WarPlacementResponse,
)
from src.models import User
from src.services.alliance.AllianceService import AllianceService
from src.services.auth.AuthService import AuthService
from src.services.alliance.war.WarService import WarService
from src.utils.db import SessionDep
from src.utils.path_params import BattlegroupPath
from src.controllers.alliance.war.war_deps import WarDep
from src.services.alliance.war.WarConfig import resolve_war_config

war_attacker_controller = APIRouter(
    prefix="/alliances/{alliance_id}/wars",
    tags=["War"],
    dependencies=[Depends(AuthService.get_current_user_in_jwt)],
)


@war_attacker_controller.get(
    "/{war_id}/bg/{battlegroup}/available-attackers",
    response_model=list[AvailableAttackerResponse],
)
async def get_available_attackers(
    alliance_id: uuid.UUID,
    war_id: uuid.UUID,
    battlegroup: BattlegroupPath,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
    war: WarDep,
    attacker_id: uuid.UUID | None = None,
    node_number: int | None = None,
):
    """List available attackers (BG roster minus defenders). Pass attacker_id to filter to a single member."""
    await AllianceService.require_visitor(session, alliance_id, current_user.id)
    config = await resolve_war_config(war, session)
    return await WarService.get_available_attackers(
        session, alliance_id, battlegroup, attacker_id, war, node_number, config
    )


@war_attacker_controller.get(
    "/{war_id}/bg/{battlegroup}/available-prefight-attackers",
    response_model=list[AvailablePrefightAttackerResponse],
)
async def get_available_prefight_attackers(
    alliance_id: uuid.UUID,
    war_id: uuid.UUID,
    battlegroup: BattlegroupPath,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
    war: WarDep,
):
    """List available pre-fight champions (has_prefight=True) for the BG."""
    await AllianceService.require_visitor(session, alliance_id, current_user.id)
    return await WarService.get_available_prefight_attackers(session, alliance_id, battlegroup, war)


@war_attacker_controller.post(
    "/{war_id}/bg/{battlegroup}/node/{node_number}/attacker",
    response_model=WarPlacementResponse,
)
async def assign_war_attacker(
    alliance_id: uuid.UUID,
    war_id: uuid.UUID,
    battlegroup: BattlegroupPath,
    node_number: int,
    body: WarAttackerAssignRequest,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
    war: WarDep,
):
    """Assign an attacker to a war node. All members can assign."""
    await AllianceService.require_member(session, alliance_id, current_user.id)
    config = await resolve_war_config(war, session)
    return await WarService.assign_attacker(
        session, war_id, alliance_id, battlegroup, node_number, body.champion_user_id, config
    )


@war_attacker_controller.delete(
    "/{war_id}/bg/{battlegroup}/node/{node_number}/attacker",
    response_model=WarPlacementResponse,
)
async def remove_war_attacker(
    alliance_id: uuid.UUID,
    war_id: uuid.UUID,
    battlegroup: BattlegroupPath,
    node_number: int,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
    war: WarDep,
):
    """Remove the attacker from a war node. All members can remove."""
    await AllianceService.require_member(session, alliance_id, current_user.id)
    return await WarService.remove_attacker(session, war_id, battlegroup, node_number)


@war_attacker_controller.patch(
    "/{war_id}/bg/{battlegroup}/node/{node_number}/ko",
    response_model=WarPlacementResponse,
)
async def update_war_ko(
    alliance_id: uuid.UUID,
    war_id: uuid.UUID,
    battlegroup: BattlegroupPath,
    node_number: int,
    body: WarKoUpdateRequest,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
    war: WarDep,
):
    """Update the KO count for a war node. All members can update."""
    await AllianceService.require_member(session, alliance_id, current_user.id)
    return await WarService.update_ko(session, war_id, battlegroup, node_number, body.ko_count)


@war_attacker_controller.patch(
    "/{war_id}/bg/{battlegroup}/node/{node_number}/complete",
    response_model=WarPlacementResponse,
)
async def toggle_combat_completed(
    alliance_id: uuid.UUID,
    war_id: uuid.UUID,
    battlegroup: BattlegroupPath,
    node_number: int,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
    war: WarDep,
):
    """Toggle combat completion for a war node. All members can toggle."""
    await AllianceService.require_member(session, alliance_id, current_user.id)
    return await WarService.toggle_combat_completed(session, war_id, battlegroup, node_number)


@war_attacker_controller.patch(
    "/{war_id}/bg/{battlegroup}/node/{node_number}/fight-not-done",
    response_model=WarPlacementResponse,
)
async def toggle_fight_not_done(
    alliance_id: uuid.UUID,
    war_id: uuid.UUID,
    battlegroup: BattlegroupPath,
    node_number: int,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
    war: WarDep,
):
    """Mark a node's fight as not done. Officers/owner only."""
    await AllianceService.require_officer(session, alliance_id, current_user.id)
    return await WarService.toggle_fight_not_done(session, war_id, battlegroup, node_number)


@war_attacker_controller.patch(
    "/{war_id}/bg/{battlegroup}/node/{node_number}/planning-error",
    response_model=WarPlacementResponse,
)
async def toggle_planning_error(
    alliance_id: uuid.UUID,
    war_id: uuid.UUID,
    battlegroup: BattlegroupPath,
    node_number: int,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
    war: WarDep,
):
    """Mark a node as a planning error. Officers/owner only."""
    await AllianceService.require_officer(session, alliance_id, current_user.id)
    return await WarService.toggle_planning_error(session, war_id, battlegroup, node_number)


@war_attacker_controller.post(
    "/{war_id}/bg/{battlegroup}/node/{node_number}/assist",
    response_model=WarPlacementResponse,
)
async def assign_war_assist(
    alliance_id: uuid.UUID,
    war_id: uuid.UUID,
    battlegroup: BattlegroupPath,
    node_number: int,
    body: WarAttackerAssignRequest,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
    war: WarDep,
):
    """Assign an assistor to a war node. All members can assign."""
    await AllianceService.require_member(session, alliance_id, current_user.id)
    return await WarService.assign_assist(
        session, war_id, alliance_id, battlegroup, node_number, body.champion_user_id
    )


@war_attacker_controller.delete(
    "/{war_id}/bg/{battlegroup}/node/{node_number}/assist",
    response_model=WarPlacementResponse,
)
async def remove_war_assist(
    alliance_id: uuid.UUID,
    war_id: uuid.UUID,
    battlegroup: BattlegroupPath,
    node_number: int,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
    war: WarDep,
):
    """Remove the assistor from a war node. All members can remove."""
    await AllianceService.require_member(session, alliance_id, current_user.id)
    return await WarService.remove_assist(session, war_id, battlegroup, node_number)

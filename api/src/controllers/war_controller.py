import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from starlette import status

from src.dto.dto_war import (
    WarCreateRequest,
    WarResponse,
    WarPlacementCreateRequest,
    WarPlacementResponse,
    WarDefenseSummaryResponse,
    WarAttackerAssignRequest,
    WarKoUpdateRequest,
    AvailableAttackerResponse,
    WarSynergyCreateRequest,
    WarSynergyResponse,
)
from src.models import User
from src.models.War import War
from src.services.AllianceService import AllianceService
from src.services.AuthService import AuthService
from src.services.WarService import WarService
from src.utils.db import SessionDep
from src.utils.path_params import BattlegroupPath

war_controller = APIRouter(
    prefix="/alliances/{alliance_id}/wars",
    tags=["War"],
    dependencies=[
        Depends(AuthService.is_logged_as_user),
        Depends(AuthService.get_current_user_in_jwt),
    ],
)

WAR_NOT_FOUND = "War not found"


async def _get_war(
    war_id: uuid.UUID,
    alliance_id: uuid.UUID,
    session: SessionDep,
) -> War:
    return await WarService.get_war(session, war_id, alliance_id)


WarDep = Annotated[War, Depends(_get_war)]




@war_controller.post(
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
    account = await AllianceService.assert_officer_or_owner_by_id(session, alliance_id, current_user.id)
    return await WarService.create_war(session, alliance_id, body.opponent_name, account.id)


@war_controller.get(
    "",
    response_model=list[WarResponse],
)
async def list_wars(
    alliance_id: uuid.UUID,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """List all wars for an alliance. All members can view."""
    await AllianceService.get_user_account_in_alliance(session, current_user.id, alliance_id)
    return await WarService.get_wars(session, alliance_id)


@war_controller.get(
    "/current",
    response_model=WarResponse,
)
async def get_current_war(
    alliance_id: uuid.UUID,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Get the currently active war for an alliance. All members can view."""
    await AllianceService.get_user_account_in_alliance(session, current_user.id, alliance_id)
    return await WarService.get_current_war(session, alliance_id)


@war_controller.get(
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
    await AllianceService.get_user_account_in_alliance(session, current_user.id, alliance_id)
    return await WarService.get_war_defense(session, war_id, battlegroup)


@war_controller.post(
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
    account = await AllianceService.assert_officer_or_owner_by_id(session, alliance_id, current_user.id)
    return await WarService.place_defender(session, war_id, battlegroup, body, account.id)


@war_controller.delete(
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
    await AllianceService.assert_officer_or_owner_by_id(session, alliance_id, current_user.id)
    await WarService.remove_defender(session, war_id, battlegroup, node_number)


@war_controller.post(
    "/{war_id}/end",
    response_model=WarResponse,
)
async def end_war(
    alliance_id: uuid.UUID,
    war_id: uuid.UUID,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Mark a war as ended. Officers/owner only."""
    await AllianceService.assert_officer_or_owner_by_id(session, alliance_id, current_user.id)
    return await WarService.end_war(session, war_id, alliance_id)


@war_controller.delete(
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
    await AllianceService.assert_officer_or_owner_by_id(session, alliance_id, current_user.id)
    count = await WarService.clear_bg(session, war_id, battlegroup)
    return {"deleted": count}


@war_controller.get(
    "/{war_id}/bg/{battlegroup}/available-attackers",
    response_model=list[AvailableAttackerResponse],
)
async def get_available_attackers(
    alliance_id: uuid.UUID,
    battlegroup: BattlegroupPath,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
    war: WarDep,
):
    """List available attackers (BG roster minus defenders). All members can view."""
    await AllianceService.get_user_account_in_alliance(session, current_user.id, alliance_id)
    return await WarService.get_available_attackers(session, alliance_id, battlegroup)


@war_controller.post(
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
    await AllianceService.get_user_account_in_alliance(session, current_user.id, alliance_id)
    return await WarService.assign_attacker(
        session, war_id, alliance_id, battlegroup, node_number, body.champion_user_id
    )


@war_controller.delete(
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
    await AllianceService.get_user_account_in_alliance(session, current_user.id, alliance_id)
    return await WarService.remove_attacker(session, war_id, battlegroup, node_number)


@war_controller.patch(
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
    await AllianceService.get_user_account_in_alliance(session, current_user.id, alliance_id)
    return await WarService.update_ko(session, war_id, battlegroup, node_number, body.ko_count)


@war_controller.get(
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
    await AllianceService.get_user_account_in_alliance(session, current_user.id, alliance_id)
    return await WarService.get_synergy_attackers(session, war_id, battlegroup)


@war_controller.post(
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
    await AllianceService.get_user_account_in_alliance(session, current_user.id, alliance_id)
    return await WarService.add_synergy_attacker(
        session, war_id, alliance_id, battlegroup, body.champion_user_id, body.target_champion_user_id, current_user.id
    )


@war_controller.delete(
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
    await AllianceService.get_user_account_in_alliance(session, current_user.id, alliance_id)
    await WarService.remove_synergy_attacker(session, war_id, battlegroup, champion_user_id)

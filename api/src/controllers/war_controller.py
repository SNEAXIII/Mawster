import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
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
)
from src.models import User
from src.models.GameAccount import GameAccount
from src.models.War import War
from src.Messages.alliance_messages import ALLIANCE_NOT_FOUND
from src.services.AllianceService import AllianceService
from src.services.AuthService import AuthService
from src.services.WarService import WarService
from src.utils.db import SessionDep
from src.utils.path_params import BattlegroupPath
from sqlmodel import select

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


async def _get_user_account_in_alliance(
    session: SessionDep,
    current_user: User,
    alliance_id: uuid.UUID,
) -> GameAccount:
    """Find the current user's game account that belongs to this alliance."""
    result = await session.exec(
        select(GameAccount).where(
            GameAccount.user_id == current_user.id,
            GameAccount.alliance_id == alliance_id,
        )
    )
    account = result.first()
    if account is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this alliance",
        )
    return account


async def _assert_officer_or_owner(
    session: SessionDep,
    current_user: User,
    alliance_id: uuid.UUID,
) -> GameAccount:
    """Ensure the current user is owner or officer of the alliance."""
    alliance = await AllianceService._load_alliance_with_relations(session, alliance_id)
    if alliance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=ALLIANCE_NOT_FOUND)

    # Collect current user's game account IDs
    user_accounts_result = await session.exec(
        select(GameAccount).where(GameAccount.user_id == current_user.id)
    )
    user_accounts = user_accounts_result.all()
    user_account_ids = {a.id for a in user_accounts}

    # Check owner
    if alliance.owner_id in user_account_ids:
        account = next(a for a in user_accounts if a.id == alliance.owner_id)
        return account

    # Check officers
    officer_ids = {off.game_account_id for off in alliance.officers}
    common = user_account_ids & officer_ids
    if common:
        account = next(a for a in user_accounts if a.id in common)
        return account

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Only the alliance owner or an officer can perform this action",
    )


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
    account = await _assert_officer_or_owner(session, current_user, alliance_id)
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
    await _get_user_account_in_alliance(session, current_user, alliance_id)
    return await WarService.get_wars(session, alliance_id)


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
    await _get_user_account_in_alliance(session, current_user, alliance_id)
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
    account = await _assert_officer_or_owner(session, current_user, alliance_id)
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
    await _assert_officer_or_owner(session, current_user, alliance_id)
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
    await _assert_officer_or_owner(session, current_user, alliance_id)
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
    await _assert_officer_or_owner(session, current_user, alliance_id)
    count = await WarService.clear_bg(session, war_id, battlegroup)
    return {"deleted": count}


@war_controller.get(
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
):
    """List available attackers (BG roster minus defenders). All members can view."""
    await _get_user_account_in_alliance(session, current_user, alliance_id)
    return await WarService.get_available_attackers(session, war_id, alliance_id, battlegroup)


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
    await _get_user_account_in_alliance(session, current_user, alliance_id)
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
    await _get_user_account_in_alliance(session, current_user, alliance_id)
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
    await _get_user_account_in_alliance(session, current_user, alliance_id)
    return await WarService.update_ko(session, war_id, battlegroup, node_number, body.ko_count)

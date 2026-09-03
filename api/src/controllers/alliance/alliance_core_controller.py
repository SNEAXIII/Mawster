import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from starlette import status

from src.dto.account.game.dto_game_account import GameAccountResponse
from src.dto.alliance.dto_alliance import (
    AllianceCreateRequest,
    AllianceDeleteRequest,
    AllianceListingResponse,
    AllianceMyRolesResponse,
    AllianceResponse,
    AllianceUpdateEloRequest,
    AllianceUpdateTierRequest,
)
from src.Messages.alliance_messages import ALLIANCE_NOT_FOUND
from src.models import User
from src.models.alliance.Alliance import Alliance
from src.services.alliance.AllianceService import AllianceService
from src.services.auth.AuthService import AuthService
from src.utils.db import SessionDep

alliance_core_controller = APIRouter(
    prefix="/alliances",
    tags=["Alliances"],
    dependencies=[Depends(AuthService.get_current_user_in_jwt)],
)


def _to_response(alliance: Alliance) -> AllianceResponse:
    return AllianceResponse.model_validate(alliance)


@alliance_core_controller.get("/eligible-owners", response_model=list[GameAccountResponse])
async def get_eligible_owners(
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Get the current user's game accounts that are NOT in any alliance (eligible to create one)."""
    return await AllianceService.get_eligible_owners(session, current_user.id)


@alliance_core_controller.get(
    "/{alliance_id}/eligible-members", response_model=list[GameAccountResponse]
)
async def get_eligible_members(
    alliance_id: uuid.UUID,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Get all game accounts NOT in any alliance (can be invited to this one).

    Scoped to the alliance doing the inviting — inviting is an act of an alliance,
    never of a player at large — and reserved to its owner and officers: the list
    is the whole player base minus the accounts already in an alliance.
    """
    await AllianceService.require_officer(session, alliance_id, current_user.id)
    return await AllianceService.get_eligible_members(session)


@alliance_core_controller.get(
    "/{alliance_id}/eligible-visitors", response_model=list[GameAccountResponse]
)
async def get_eligible_visitors(
    alliance_id: uuid.UUID,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Get all game accounts that can be invited as visitors.

    Officers/owner only — same reason as `/eligible-members`.
    """
    await AllianceService.require_officer(session, alliance_id, current_user.id)
    return await AllianceService.get_eligible_visitors(session, alliance_id)


@alliance_core_controller.post(
    "", response_model=AllianceResponse, status_code=status.HTTP_201_CREATED
)
async def create_alliance(
    body: AllianceCreateRequest,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Create a new alliance. The owner game account must belong to the current user."""
    alliance = await AllianceService.create_alliance(
        session=session,
        name=body.name,
        tag=body.tag,
        owner_id=body.owner_id,
        current_user_id=current_user.id,
    )
    return _to_response(alliance)


@alliance_core_controller.get("", response_model=list[AllianceListingResponse])
async def get_all_alliances(session: SessionDep):
    """Get all alliances, as the facade an outsider is entitled to.

    Never the interior: who plays in an alliance is for its own members and
    Visitors to see.
    """
    alliances = await AllianceService.get_all_alliances(session)
    return [_to_response(a) for a in alliances]


@alliance_core_controller.get("/mine", response_model=list[AllianceResponse])
async def get_my_alliances(
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Get only alliances where the current user has a game account as a member."""
    alliances = await AllianceService.get_my_alliances(session, current_user.id)
    return [_to_response(a) for a in alliances]


@alliance_core_controller.get("/my-visited", response_model=list[AllianceResponse])
async def get_my_visited_alliances(
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Get alliances where the current user's game account is currently a visitor."""
    alliances = await AllianceService.get_my_visited_alliances(session, current_user.id)
    return [_to_response(a) for a in alliances]


@alliance_core_controller.get("/my-roles", response_model=AllianceMyRolesResponse)
async def get_my_alliance_roles(
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Get the current user's role in each of their alliances."""
    return await AllianceService.get_my_roles(session, current_user.id)


@alliance_core_controller.get("/accessible", response_model=list[AllianceResponse])
async def get_accessible_alliances(
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Get alliances the current user can access (member + visitor)."""
    alliances = await AllianceService.get_accessible_alliances(session, current_user.id)
    return [_to_response(a) for a in alliances]


@alliance_core_controller.get(
    "/{alliance_id}", response_model=AllianceResponse | AllianceListingResponse
)
async def get_alliance(
    alliance_id: uuid.UUID,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Get a specific alliance by ID.

    Members and Visitors get the interior — the roster and the officers. Anyone
    else gets the facade: an alliance exists publicly, its people do not.
    """
    alliance = await AllianceService.get_alliance(session, alliance_id)
    if alliance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=ALLIANCE_NOT_FOUND)
    if not await AllianceService.is_visitor(session, current_user.id, alliance_id):
        return AllianceListingResponse.model_validate(alliance)
    return _to_response(alliance)


@alliance_core_controller.put("/{alliance_id}", response_model=AllianceResponse)
async def update_alliance(
    alliance_id: uuid.UUID,
    body: AllianceCreateRequest,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Update an alliance. Only the owner can update."""
    alliance = await AllianceService.get_alliance(session, alliance_id)
    if alliance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=ALLIANCE_NOT_FOUND)
    await AllianceService.require_owner(session, alliance_id, current_user.id)
    updated = await AllianceService.update_alliance(
        session=session, alliance=alliance, name=body.name, tag=body.tag
    )
    return _to_response(updated)


@alliance_core_controller.patch("/{alliance_id}/elo", response_model=AllianceResponse)
async def update_alliance_elo(
    alliance_id: uuid.UUID,
    body: AllianceUpdateEloRequest,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Update alliance ELO. Officers/owner only."""
    alliance = await session.get(Alliance, alliance_id)
    if alliance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=ALLIANCE_NOT_FOUND)
    await AllianceService.require_officer(session, alliance_id, current_user.id)
    updated = await AllianceService.update_elo(session, alliance, body.elo)
    return _to_response(updated)


@alliance_core_controller.patch("/{alliance_id}/tier", response_model=AllianceResponse)
async def update_alliance_tier(
    alliance_id: uuid.UUID,
    body: AllianceUpdateTierRequest,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Update alliance Tier. Officers/owner only."""
    alliance = await session.get(Alliance, alliance_id)
    if alliance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=ALLIANCE_NOT_FOUND)
    await AllianceService.require_officer(session, alliance_id, current_user.id)
    updated = await AllianceService.update_tier(session, alliance, body.tier)
    return _to_response(updated)


@alliance_core_controller.delete("/{alliance_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_alliance(
    alliance_id: uuid.UUID,
    body: AllianceDeleteRequest,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Soft-delete an alliance. Owner only, and only while they are its last member.

    The caller must retype the alliance name in `body.name` to confirm.
    """
    alliance = await AllianceService.get_alliance(session, alliance_id)
    if alliance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=ALLIANCE_NOT_FOUND)
    await AllianceService.require_owner(session, alliance_id, current_user.id)
    await AllianceService.delete_alliance(session, alliance, body.name)

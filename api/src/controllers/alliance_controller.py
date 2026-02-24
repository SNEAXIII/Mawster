import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from starlette import status

from src.dto.dto_game import (
    AllianceAddMemberRequest,
    AllianceAddOfficerRequest,
    AllianceMemberResponse,
    AllianceOfficerResponse,
    AllianceCreateRequest,
    AllianceRemoveOfficerRequest,
    AllianceResponse,
    AllianceSetGroupRequest,
    GameAccountResponse,
)
from src.models import User
from src.models.Alliance import Alliance
from src.services.AuthService import AuthService
from src.services.AllianceService import AllianceService
from src.utils.db import SessionDep

alliance_controller = APIRouter(
    prefix="/alliances",
    tags=["Alliances"],
    dependencies=[
        Depends(AuthService.is_logged_as_user),
        Depends(AuthService.get_current_user_in_jwt),
    ],
)


def _to_response(alliance: Alliance) -> AllianceResponse:
    """Convert an Alliance ORM object (with loaded relations) to a response DTO."""
    officer_ids = {adj.game_account_id for adj in alliance.officers}
    return AllianceResponse(
        id=alliance.id,
        name=alliance.name,
        tag=alliance.tag,
        owner_id=alliance.owner_id,
        owner_pseudo=alliance.owner.game_pseudo,
        created_at=alliance.created_at,
        officers=[
            AllianceOfficerResponse(
                id=adj.id,
                game_account_id=adj.game_account_id,
                game_pseudo=adj.game_account.game_pseudo,
                assigned_at=adj.assigned_at,
            )
            for adj in alliance.officers
        ],
        members=[
            AllianceMemberResponse(
                id=m.id,
                user_id=m.user_id,
                game_pseudo=m.game_pseudo,
                alliance_group=m.alliance_group,
                is_owner=(m.id == alliance.owner_id),
                is_officer=(m.id in officer_ids),
            )
            for m in alliance.members
        ],
        member_count=len(alliance.members),
    )


# ---- Eligibility endpoints ----

@alliance_controller.get(
    "/eligible-owners",
    response_model=list[GameAccountResponse],
)
async def get_eligible_owners(
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Get the current user's game accounts that are NOT in any alliance (eligible to create one)."""
    accounts = await AllianceService.get_eligible_owners(session, current_user.id)
    return accounts


@alliance_controller.get(
    "/{alliance_id}/eligible-officers",
    response_model=list[GameAccountResponse],
)
async def get_eligible_officers(
    alliance_id: uuid.UUID,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Get members of the alliance eligible to become officers (not owner, not already officer)."""
    return await AllianceService.get_eligible_officers(session, alliance_id)


@alliance_controller.get(
    "/eligible-members",
    response_model=list[GameAccountResponse],
)
async def get_eligible_members(
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Get all game accounts NOT in any alliance (can be invited)."""
    return await AllianceService.get_eligible_members(session)


# ---- CRUD ----

@alliance_controller.post(
    "",
    response_model=AllianceResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_alliance(
    body: AllianceCreateRequest,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Create a new alliance. The owner game account must belong to the current user
    and must not already be in an alliance. The owner is automatically added as a member."""
    alliance = await AllianceService.create_alliance(
        session=session,
        name=body.name,
        tag=body.tag,
        owner_id=body.owner_id,
        current_user_id=current_user.id,
    )
    return _to_response(alliance)


@alliance_controller.get(
    "",
    response_model=list[AllianceResponse],
)
async def get_all_alliances(
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Get all alliances."""
    alliances = await AllianceService.get_all_alliances(session)
    return [_to_response(a) for a in alliances]


@alliance_controller.get(
    "/mine",
    response_model=list[AllianceResponse],
)
async def get_my_alliances(
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Get only alliances where the current user has a game account as a member."""
    alliances = await AllianceService.get_my_alliances(session, current_user.id)
    return [_to_response(a) for a in alliances]


@alliance_controller.get(
    "/{alliance_id}",
    response_model=AllianceResponse,
)
async def get_alliance(
    alliance_id: uuid.UUID,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Get a specific alliance by ID."""
    alliance = await AllianceService.get_alliance(session, alliance_id)
    if alliance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alliance not found")
    return _to_response(alliance)


@alliance_controller.put(
    "/{alliance_id}",
    response_model=AllianceResponse,
)
async def update_alliance(
    alliance_id: uuid.UUID,
    body: AllianceCreateRequest,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Update an alliance. Only the owner can update."""
    alliance = await AllianceService.get_alliance(session, alliance_id)
    if alliance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alliance not found")
    await AllianceService._assert_is_owner(session, alliance, current_user.id)
    updated = await AllianceService.update_alliance(
        session=session,
        alliance=alliance,
        name=body.name,
        tag=body.tag,
    )
    return _to_response(updated)


@alliance_controller.delete(
    "/{alliance_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_alliance(
    alliance_id: uuid.UUID,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Delete an alliance. Only the owner can delete."""
    alliance = await AllianceService.get_alliance(session, alliance_id)
    if alliance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alliance not found")
    await AllianceService._assert_is_owner(session, alliance, current_user.id)
    await AllianceService.delete_alliance(session, alliance)


# ---- Member management ----

@alliance_controller.post(
    "/{alliance_id}/members",
    response_model=AllianceResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_member(
    alliance_id: uuid.UUID,
    body: AllianceAddMemberRequest,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Add a game account as member of the alliance.
    Only the owner or an officer can add members."""
    alliance = await AllianceService.get_alliance(session, alliance_id)
    if alliance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alliance not found")
    await AllianceService._assert_is_owner_or_officer(session, alliance, current_user.id)
    updated = await AllianceService.add_member(
        session=session,
        alliance_id=alliance_id,
        game_account_id=body.game_account_id,
    )
    return _to_response(updated)


@alliance_controller.delete(
    "/{alliance_id}/members/{game_account_id}",
    response_model=AllianceResponse,
)
async def remove_member(
    alliance_id: uuid.UUID,
    game_account_id: uuid.UUID,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Remove a member from the alliance. Owner can remove anyone.
    Officers can remove regular members but NOT other officers.
    Cannot remove the owner."""
    alliance = await AllianceService.get_alliance(session, alliance_id)
    if alliance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alliance not found")
    await AllianceService._assert_can_remove_member(session, alliance, current_user.id, game_account_id)
    updated = await AllianceService.remove_member(
        session=session,
        alliance_id=alliance_id,
        game_account_id=game_account_id,
    )
    return _to_response(updated)


# ---- Officer management ----

@alliance_controller.post(
    "/{alliance_id}/officers",
    response_model=AllianceResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_adjoint(
    alliance_id: uuid.UUID,
    body: AllianceAddOfficerRequest,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Add an adjoint (deputy) to an alliance. Only the owner can add officers.
    The game account must already be a member of the alliance."""
    alliance = await AllianceService.get_alliance(session, alliance_id)
    if alliance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alliance not found")
    await AllianceService._assert_is_owner(session, alliance, current_user.id)
    updated = await AllianceService.add_adjoint(
        session=session,
        alliance_id=alliance_id,
        game_account_id=body.game_account_id,
    )
    return _to_response(updated)


@alliance_controller.delete(
    "/{alliance_id}/officers",
    response_model=AllianceResponse,
)
async def remove_adjoint(
    alliance_id: uuid.UUID,
    body: AllianceRemoveOfficerRequest,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Remove an adjoint from an alliance. Only the owner can remove officers."""
    alliance = await AllianceService.get_alliance(session, alliance_id)
    if alliance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alliance not found")
    await AllianceService._assert_is_owner(session, alliance, current_user.id)
    updated = await AllianceService.remove_adjoint(
        session=session,
        alliance_id=alliance_id,
        game_account_id=body.game_account_id,
    )
    return _to_response(updated)


# ---- Group management ----

@alliance_controller.patch(
    "/{alliance_id}/members/{game_account_id}/group",
    response_model=AllianceResponse,
)
async def set_member_group(
    alliance_id: uuid.UUID,
    game_account_id: uuid.UUID,
    body: AllianceSetGroupRequest,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Set the group (1, 2, 3 or null) for a member. Max 10 members per group.
    Only the owner or an officer can manage groups."""
    alliance = await AllianceService.get_alliance(session, alliance_id)
    if alliance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alliance not found")
    await AllianceService._assert_is_owner_or_officer(session, alliance, current_user.id)
    updated = await AllianceService.set_member_group(
        session=session,
        alliance_id=alliance_id,
        game_account_id=game_account_id,
        group=body.group,
    )
    return _to_response(updated)

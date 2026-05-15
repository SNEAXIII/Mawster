import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from starlette import status

from src.dto.alliance.dto_alliance import (
    AllianceAddOfficerRequest,
    AllianceRemoveOfficerRequest,
    AllianceResponse,
    AllianceSetGroupRequest,
)
from src.Messages.alliance_messages import ALLIANCE_NOT_FOUND
from src.models import User
from src.models.Alliance import Alliance
from src.services.auth.AuthService import AuthService
from src.services.alliance.AllianceService import AllianceService
from src.utils.db import SessionDep

alliance_member_controller = APIRouter(
    prefix="/alliances",
    tags=["Alliances"],
    dependencies=[Depends(AuthService.get_current_user_in_jwt)],
)


def _to_response(alliance: Alliance) -> AllianceResponse:
    return AllianceResponse.model_validate(alliance)


@alliance_member_controller.delete(
    "/{alliance_id}/members/{game_account_id}", response_model=AllianceResponse
)
async def remove_member(
    alliance_id: uuid.UUID,
    game_account_id: uuid.UUID,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Remove a member from the alliance. Owner can remove anyone; officers cannot remove other officers."""
    alliance = await AllianceService.get_alliance(session, alliance_id)
    if alliance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=ALLIANCE_NOT_FOUND)
    await AllianceService._assert_can_remove_member(
        session, alliance, current_user.id, game_account_id
    )
    updated = await AllianceService.remove_member(
        session=session, alliance_id=alliance_id, game_account_id=game_account_id
    )
    return _to_response(updated)


@alliance_member_controller.post(
    "/{alliance_id}/officers",
    response_model=AllianceResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_officer(
    alliance_id: uuid.UUID,
    body: AllianceAddOfficerRequest,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Add an officer to an alliance. Only the owner can add officers."""
    alliance = await AllianceService.get_alliance(session, alliance_id)
    if alliance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=ALLIANCE_NOT_FOUND)
    await AllianceService.require_owner(session, alliance_id, current_user.id)
    updated = await AllianceService.add_officer(
        session=session, alliance_id=alliance_id, game_account_id=body.game_account_id
    )
    return _to_response(updated)


@alliance_member_controller.delete("/{alliance_id}/officers", response_model=AllianceResponse)
async def remove_officer(
    alliance_id: uuid.UUID,
    body: AllianceRemoveOfficerRequest,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Remove an officer from an alliance. Only the owner can remove officers."""
    alliance = await AllianceService.get_alliance(session, alliance_id)
    if alliance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=ALLIANCE_NOT_FOUND)
    await AllianceService.require_owner(session, alliance_id, current_user.id)
    updated = await AllianceService.remove_officer(
        session=session, alliance_id=alliance_id, game_account_id=body.game_account_id
    )
    return _to_response(updated)


@alliance_member_controller.patch(
    "/{alliance_id}/members/{game_account_id}/group", response_model=AllianceResponse
)
async def set_member_group(
    alliance_id: uuid.UUID,
    game_account_id: uuid.UUID,
    body: AllianceSetGroupRequest,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Set the group (1, 2, 3 or null) for a member. Only the owner or an officer can manage groups."""
    await AllianceService.require_officer(session, alliance_id, current_user.id)
    updated = await AllianceService.set_member_group(
        session=session,
        alliance_id=alliance_id,
        game_account_id=game_account_id,
        group=body.group,
    )
    return _to_response(updated)

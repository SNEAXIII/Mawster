import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from starlette import status

from src.dto.alliance.dto_invitation import (
    AllianceInvitationCreateRequest,
    AllianceInvitationResponse,
)
from src.Messages.alliance_messages import ALLIANCE_NOT_FOUND
from src.models import User
from src.models.AllianceInvitation import AllianceInvitation
from src.services.auth.AuthService import AuthService
from src.services.alliance.AllianceService import AllianceService
from src.services.alliance.AllianceInvitationService import AllianceInvitationService
from src.utils.db import SessionDep

alliance_invitation_controller = APIRouter(
    prefix="/alliances",
    tags=["Alliances"],
    dependencies=[Depends(AuthService.get_current_user_in_jwt)],
)


def _invitation_to_response(inv: AllianceInvitation) -> AllianceInvitationResponse:
    return AllianceInvitationResponse.model_validate(inv)


@alliance_invitation_controller.get(
    "/my-invitations", response_model=list[AllianceInvitationResponse]
)
async def get_my_invitations(
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Get all pending invitations for the current user's game accounts."""
    invitations = await AllianceInvitationService.get_invitations_for_user(session, current_user.id)
    return [_invitation_to_response(inv) for inv in invitations]


@alliance_invitation_controller.post(
    "/invitations/{invitation_id}/accept", response_model=AllianceInvitationResponse
)
async def accept_invitation(
    invitation_id: uuid.UUID,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Accept a pending invitation — the game account joins the alliance."""
    invitation = await AllianceInvitationService.accept_invitation(
        session, invitation_id, current_user.id
    )
    reloaded = await session.get(AllianceInvitation, invitation.id)
    await session.refresh(reloaded, ["alliance", "game_account", "invited_by"])
    return _invitation_to_response(reloaded)


@alliance_invitation_controller.post(
    "/invitations/{invitation_id}/decline", response_model=AllianceInvitationResponse
)
async def decline_invitation(
    invitation_id: uuid.UUID,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Decline a pending invitation."""
    invitation = await AllianceInvitationService.decline_invitation(
        session, invitation_id, current_user.id
    )
    reloaded = await session.get(AllianceInvitation, invitation.id)
    await session.refresh(reloaded, ["alliance", "game_account", "invited_by"])
    return _invitation_to_response(reloaded)


@alliance_invitation_controller.post(
    "/{alliance_id}/invitations",
    response_model=AllianceInvitationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def invite_member(
    alliance_id: uuid.UUID,
    body: AllianceInvitationCreateRequest,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Invite a game account to join the alliance. Only the owner or an officer can invite."""
    alliance = await AllianceService.get_alliance(session, alliance_id)
    if alliance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=ALLIANCE_NOT_FOUND)
    await AllianceService.require_officer(session, alliance_id, current_user.id)
    invitation = await AllianceInvitationService.create_invitation(
        session=session,
        alliance_id=alliance_id,
        game_account_id=body.game_account_id,
        invited_by_user_id=current_user.id,
        alliance=alliance,
        invitation_type=body.type,
    )
    loaded = await AllianceInvitationService.get_invitations_for_alliance(session, alliance_id)
    inv = next((i for i in loaded if i.id == invitation.id), invitation)
    return _invitation_to_response(inv)


@alliance_invitation_controller.get(
    "/{alliance_id}/invitations", response_model=list[AllianceInvitationResponse]
)
async def get_alliance_invitations(
    alliance_id: uuid.UUID,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Get all pending invitations for an alliance. Only the owner or an officer can view."""
    await AllianceService.require_officer(session, alliance_id, current_user.id)
    invitations = await AllianceInvitationService.get_invitations_for_alliance(session, alliance_id)
    return [_invitation_to_response(inv) for inv in invitations]


@alliance_invitation_controller.delete(
    "/{alliance_id}/invitations/{invitation_id}", status_code=status.HTTP_200_OK
)
async def cancel_invitation(
    alliance_id: uuid.UUID,
    invitation_id: uuid.UUID,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Cancel a pending invitation. Only the owner or an officer can cancel."""
    alliance = await AllianceService.get_alliance(session, alliance_id)
    if alliance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=ALLIANCE_NOT_FOUND)
    await AllianceService.require_officer(session, alliance_id, current_user.id)
    await AllianceInvitationService.cancel_invitation(
        session, invitation_id, current_user.id, alliance
    )
    return {"message": "Invitation cancelled"}

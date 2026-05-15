import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from starlette import status

from src.dto.alliance.dto_visitor import AllianceVisitorResponse
from src.Messages.alliance_messages import ALLIANCE_NOT_FOUND
from src.models import User
from src.services.auth.AuthService import AuthService
from src.services.alliance.AllianceService import AllianceService
from src.services.alliance.AllianceVisitorService import AllianceVisitorService
from src.utils.db import SessionDep

alliance_visitor_controller = APIRouter(
    prefix="/alliances",
    tags=["Alliances"],
    dependencies=[Depends(AuthService.get_current_user_in_jwt)],
)


@alliance_visitor_controller.get(
    "/{alliance_id}/visitors", response_model=list[AllianceVisitorResponse]
)
async def get_alliance_visitors(
    alliance_id: uuid.UUID,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Get all current visitors of an alliance."""
    await AllianceService.is_visitor(session, alliance_id, current_user.id)
    visitors = await AllianceVisitorService.get_visitors(session, alliance_id)
    return [AllianceVisitorResponse.model_validate(v) for v in visitors]


@alliance_visitor_controller.delete(
    "/{alliance_id}/visitors/me", status_code=status.HTTP_204_NO_CONTENT
)
async def leave_as_visitor(
    alliance_id: uuid.UUID,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Leave a visited alliance. The current user must be a visitor of it."""
    visitor_account = await AllianceService.get_user_visitor_account(
        session, alliance_id, current_user.id
    )
    await AllianceVisitorService.remove_visitor(session, alliance_id, visitor_account.id)


@alliance_visitor_controller.delete(
    "/{alliance_id}/visitors/{game_account_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def kick_visitor(
    alliance_id: uuid.UUID,
    game_account_id: uuid.UUID,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Remove a visitor from the alliance. Only the owner or an officer can kick."""
    alliance = await AllianceService.get_alliance(session, alliance_id)
    if alliance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=ALLIANCE_NOT_FOUND)
    await AllianceService.require_officer(session, alliance_id, current_user.id)
    await AllianceVisitorService.remove_visitor(session, alliance_id, game_account_id)

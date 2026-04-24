import uuid
from typing import Annotated
from src.models import GameAccount
from sqlmodel import select

from fastapi import APIRouter, Depends, HTTPException
from starlette import status

from src.dto.dto_alliance import (
    AllianceAddOfficerRequest,
    AllianceMyRolesResponse,
    AllianceCreateRequest,
    AllianceRemoveOfficerRequest,
    AllianceResponse,
    AllianceSetGroupRequest,
)
from src.dto.dto_invitation import (
    AllianceInvitationCreateRequest,
    AllianceInvitationResponse,
)
from src.dto.dto_game_account import GameAccountResponse
from src.Messages.alliance_messages import ALLIANCE_NOT_FOUND
from src.models import User
from src.models.Alliance import Alliance
from src.models.AllianceInvitation import AllianceInvitation
from src.services.AuthService import AuthService
from src.services.AllianceService import AllianceService
from src.services.AllianceInvitationService import AllianceInvitationService
from src.utils.db import SessionDep

statistics_controller = APIRouter(
    prefix="/statistics",
    tags=["Statistics"],
    dependencies=[
        Depends(AuthService.is_logged_as_user),
        Depends(AuthService.get_current_user_in_jwt),
    ],
)


@statistics_controller.get(
    "/current_season",
    # response_model=None,
)
async def get_current_season_statistics(
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Get the current season statistics."""
    sql = select(GameAccount.id, GameAccount.game_pseudo, GameAccount.alliance_group).where(
        GameAccount.alliance_id == current_user.alliance_id
    )
    session_result = (await session.exec(sql)).all()
    print(session_result)
    print(5)
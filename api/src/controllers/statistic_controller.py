from typing import Annotated
from src.models import GameAccount
from sqlmodel import select

from fastapi import APIRouter, Depends

from src.models import User
from src.services.AuthService import AuthService
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

import uuid
from typing import Annotated
from src.models import ChampionUser, Season, War, WarDefensePlacement, GameAccount
from sqlalchemy import func
from sqlmodel import select

from fastapi import APIRouter, Depends

from src.models import User
from src.services.AuthService import AuthService
from src.utils.db import SessionDep

statistics_controller = APIRouter(
    prefix="/statistics",
    tags=["Statistics"],
    dependencies=[
        # Depends(AuthService.is_logged_as_user),
        # Depends(AuthService.get_current_user_in_jwt),
    ],
)


@statistics_controller.get(
    "/current_season",
    # response_model=None,
)
async def get_current_season_statistics(
    session: SessionDep,
    # current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Get the current season statistics."""
    sql = (
        select(
            GameAccount.id,
            GameAccount.game_pseudo,
            GameAccount.alliance_group,
            func.count().label("total_fights"),
        )
        .join(ChampionUser, ChampionUser.game_account_id == GameAccount.id)
        .join(WarDefensePlacement, WarDefensePlacement.attacker_champion_user_id == ChampionUser.id)
        .join(War, WarDefensePlacement.war_id == War.id)
        .join(Season, War.season_id == Season.id)
        .where(
            GameAccount.alliance_id == uuid.UUID("7e7b2e7c-7a51-4b14-95b8-fe21558a0146")
            # GameAccount.alliance_id == current_user.alliance_id
        )
        .group_by(GameAccount.id, GameAccount.game_pseudo, GameAccount.alliance_group)
    )
    session_result = (await session.exec(sql)).all()
    for elem in session_result:
        print(elem)
    print(5)
    return None

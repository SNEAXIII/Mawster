import uuid
from typing import Annotated

from fastapi import APIRouter, Depends

from src.dto.alliance.war.dto_ranking_history import RankingHistoryResponse
from src.models.User import User
from src.services.alliance.RankingHistoryService import RankingHistoryService
from src.services.auth.AuthService import AuthService
from src.utils.db import SessionDep

ranking_history_controller = APIRouter(
    prefix="/alliances",
    tags=["Alliances"],
    dependencies=[Depends(AuthService.get_current_user_in_jwt)],
)


@ranking_history_controller.get(
    "/{alliance_id}/ranking-history",
    response_model=RankingHistoryResponse,
)
async def get_ranking_history(
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
    alliance_id: uuid.UUID,
):
    return await RankingHistoryService.get_ranking_history(session, current_user, alliance_id)

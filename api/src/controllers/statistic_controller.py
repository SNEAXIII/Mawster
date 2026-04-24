import uuid
from src.models import ChampionUser, Season, War, WarDefensePlacement, GameAccount
from sqlalchemy import and_, func, cast, Integer, case
from sqlmodel import select

from fastapi import APIRouter, Depends

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

_miniboss_case = case((WarDefensePlacement.node_number.between(37, 49), 1), else_=0)
_boss_case = case((WarDefensePlacement.node_number == 50, 1), else_=0)
_total_kos = func.sum(WarDefensePlacement.ko_count)
_total_fights = func.count()
_total_miniboss = func.sum(_miniboss_case)


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
            cast(_total_kos, Integer).label("total_kos"),
            _total_fights.label("total_fights"),
            cast(func.sum(_miniboss_case), Integer).label("total_miniboss"),
            cast(func.sum(_boss_case), Integer).label("total_boss"),
            cast(
                func.round((1 - _total_kos / _total_fights) * 100, 2),
                Integer,
            ).label("ratio"),
            cast(
                func.round(
                    func.ifnull(1 - _total_kos / func.nullif(func.sum(_miniboss_case), 0), 0) * 100,
                    2,
                ),
                Integer,
            ).label("ratio_mb"),
        )
        .join(ChampionUser, ChampionUser.game_account_id == GameAccount.id)
        .join(WarDefensePlacement, WarDefensePlacement.attacker_champion_user_id == ChampionUser.id)
        .join(War, WarDefensePlacement.war_id == War.id)
        .join(Season, and_(War.season_id == Season.id, Season.is_active == True))
        .where(
            GameAccount.alliance_id == uuid.UUID("7e7b2e7c-7a51-4b14-95b8-fe21558a0146"),
            # GameAccount.alliance_id == current_user.alliance_id,
            
        )
        .group_by(GameAccount.id, GameAccount.game_pseudo, GameAccount.alliance_group)
    )
    session_result = (await session.exec(sql)).all()
    for elem in session_result:
        if elem.game_pseudo == "Centurion":
            print(elem)
    print(5)
    return None

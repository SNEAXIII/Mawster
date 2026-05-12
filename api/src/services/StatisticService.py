import uuid
from typing import Optional

from fastapi import HTTPException
from starlette import status

from src.models import User
from src.models import ChampionUser, Season, War, WarDefensePlacement, GameAccount
from src.models.Alliance import Alliance
from src.models.Champion import Champion
from src.models.War import WarStatus
from src.models.WarFightRecord import WarFightRecord
from sqlalchemy import and_, func, cast, Integer, case
from sqlmodel import select

from src.dto.dto_statistic import ChampionUsageResponse, PlayerSeasonStatsResponse
from src.services.AllianceService import AllianceService
from src.utils.db import SessionDep

_is_normal = and_(
    WarDefensePlacement.is_fight_not_done == False,  # noqa: E712
    WarDefensePlacement.is_planning_error == False,  # noqa: E712
)
_is_not_done = and_(
    WarDefensePlacement.is_fight_not_done == True,  # noqa: E712
    WarDefensePlacement.is_planning_error == False,  # noqa: E712
)
_miniboss_case = case(
    (and_(_is_normal, WarDefensePlacement.node_number.between(37, 49)), 1), else_=0
)
_boss_case = case((and_(_is_normal, WarDefensePlacement.node_number == 50), 1), else_=0)
_total_kos = func.sum(case((_is_normal, WarDefensePlacement.ko_count), else_=0))
_total_fights = func.sum(case((_is_normal, 1), else_=0))
_total_not_fought = func.sum(case((_is_not_done, 1), else_=0))


class StatisticService:
    @classmethod
    async def get_active_season_statistics(
        cls, session: SessionDep, current_user: User, alliance_id: uuid.UUID
    ) -> list[PlayerSeasonStatsResponse]:
        alliance = await session.get(Alliance, alliance_id)
        if alliance is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alliance not found")
        if not await AllianceService.is_visitor(session, current_user.id, alliance_id):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alliance not found")

        sql = (
            select(
                GameAccount.id,
                GameAccount.game_pseudo,
                GameAccount.alliance_group,
                cast(_total_kos, Integer).label("total_kos"),
                cast(_total_fights, Integer).label("total_fights"),
                cast(func.sum(_miniboss_case), Integer).label("total_miniboss"),
                cast(func.sum(_boss_case), Integer).label("total_boss"),
                cast(_total_not_fought, Integer).label("total_not_fought"),
                cast((1 - _total_kos / _total_fights) * 100, Integer).label("ratio"),
            )
            .join(ChampionUser, ChampionUser.game_account_id == GameAccount.id)
            .join(
                WarDefensePlacement,
                WarDefensePlacement.attacker_champion_user_id == ChampionUser.id,
            )
            .join(War, WarDefensePlacement.war_id == War.id)
            .join(Season, and_(War.season_id == Season.id, Season.is_active == True))  # noqa: E712
            .where(GameAccount.alliance_id == alliance_id)
            .where(War.status == WarStatus.ended)
            .group_by(GameAccount.id, GameAccount.game_pseudo, GameAccount.alliance_group)
        )
        rows = (await session.exec(sql)).mappings().all()
        return [PlayerSeasonStatsResponse.model_validate(row) for row in rows]

    @classmethod
    async def get_champion_usage(
        cls,
        session: SessionDep,
        current_user: User,
        alliance_id: uuid.UUID,
        game_account_id: Optional[uuid.UUID] = None,
        war_id: Optional[uuid.UUID] = None,
    ) -> list[ChampionUsageResponse]:
        alliance = await session.get(Alliance, alliance_id)
        if alliance is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alliance not found")
        if not await AllianceService.is_visitor(session, current_user.id, alliance_id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

        conditions = [
            WarFightRecord.alliance_id == alliance_id,
            Season.is_active == True,  # noqa: E712
        ]
        if game_account_id is not None:
            conditions.append(WarFightRecord.game_account_id == game_account_id)
        if war_id is not None:
            conditions.append(WarFightRecord.war_id == war_id)

        stmt = (
            select(
                WarFightRecord.champion_id,
                Champion.name.label("champion_name"),
                cast(func.count(WarFightRecord.id), Integer).label("fight_count"),
                cast(func.sum(WarFightRecord.ko_count), Integer).label("total_kos"),
            )
            .join(Champion, Champion.id == WarFightRecord.champion_id)
            .join(Season, Season.id == WarFightRecord.season_id)
            .where(and_(*conditions))
            .group_by(WarFightRecord.champion_id, Champion.name)
            .order_by(func.count(WarFightRecord.id).desc())
        )
        rows = (await session.exec(stmt)).mappings().all()
        return [ChampionUsageResponse.model_validate(dict(row)) for row in rows]

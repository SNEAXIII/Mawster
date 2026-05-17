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
from sqlalchemy import and_, func, cast, Integer, Float, case
from sqlmodel import select

from src.dto.alliance.war.dto_statistic import ChampionUsageResponse, PlayerSeasonStatsResponse
from src.services.alliance.AllianceService import AllianceService
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
_is_assisted = WarDefensePlacement.assist_champion_user_id.is_not(None)
_fight_weight = case(
    (and_(_is_normal, _is_assisted), 0.5),
    (and_(_is_normal, ~_is_assisted), 1.0),
    else_=0,
)
_total_kos = func.sum(case((_is_normal, WarDefensePlacement.ko_count), else_=0))
_total_fights = func.sum(_fight_weight)
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

        assist_subquery = (
            select(
                ChampionUser.game_account_id.label("game_account_id"),
                func.count(WarDefensePlacement.id).label("total_assists"),
                (func.count(WarDefensePlacement.id) * 0.5).label("assist_fights"),
            )
            .join(
                WarDefensePlacement, WarDefensePlacement.assist_champion_user_id == ChampionUser.id
            )
            .join(War, WarDefensePlacement.war_id == War.id)
            .join(Season, and_(War.season_id == Season.id, Season.is_active == True))  # noqa: E712
            .where(War.alliance_id == alliance_id)
            .where(War.status == WarStatus.ended)
            .group_by(ChampionUser.game_account_id)
            .subquery()
        )

        _wars_participated = func.count(func.distinct(War.id))
        _total_fights_with_assists = _total_fights + func.coalesce(
            assist_subquery.c.assist_fights, 0
        )
        sql = (
            select(
                GameAccount.id,
                GameAccount.game_pseudo,
                GameAccount.alliance_group,
                cast(_total_kos, Integer).label("total_kos"),
                cast(_total_fights_with_assists, Float).label("total_fights"),
                cast(func.coalesce(assist_subquery.c.total_assists, 0), Integer).label(
                    "total_assists"
                ),
                cast(func.sum(_miniboss_case), Integer).label("total_miniboss"),
                cast(func.sum(_boss_case), Integer).label("total_boss"),
                cast(_total_not_fought, Integer).label("total_not_fought"),
                cast(
                    (1 - _total_kos / func.nullif(_total_fights_with_assists, 0)) * 100, Integer
                ).label("ratio"),
                cast(_wars_participated, Integer).label("wars_participated"),
                cast(
                    func.coalesce(
                        _total_fights_with_assists / func.nullif(_wars_participated, 0),
                        0.0,
                    ),
                    Float,
                ).label("avg_fights_per_war"),
                cast(
                    func.coalesce(
                        cast(func.sum(_miniboss_case) + func.sum(_boss_case), Float)
                        / func.nullif(_wars_participated, 0),
                        0.0,
                    ),
                    Float,
                ).label("avg_boss_miniboss_per_war"),
                case((GameAccount.alliance_id == alliance_id, True), else_=False).label(
                    "is_current_member"
                ),
            )
            .join(ChampionUser, ChampionUser.game_account_id == GameAccount.id)
            .join(
                WarDefensePlacement,
                WarDefensePlacement.attacker_champion_user_id == ChampionUser.id,
            )
            .join(War, WarDefensePlacement.war_id == War.id)
            .join(Season, and_(War.season_id == Season.id, Season.is_active == True))  # noqa: E712
            .outerjoin(assist_subquery, assist_subquery.c.game_account_id == GameAccount.id)
            .where(War.alliance_id == alliance_id)
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
        alliance_group: Optional[int] = None,
        deathless: Optional[bool] = None,
        perspective: str = "attacker",
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
        if alliance_group is not None:
            conditions.append(GameAccount.alliance_group == alliance_group)
        if deathless is True:
            conditions.append(WarFightRecord.ko_count == 0)

        if perspective == "defender":
            champion_id_col = WarFightRecord.defender_champion_id.label("champion_id")
            champion_join = Champion.id == WarFightRecord.defender_champion_id
            group_by_col = WarFightRecord.defender_champion_id
        else:
            champion_id_col = WarFightRecord.champion_id
            champion_join = Champion.id == WarFightRecord.champion_id
            group_by_col = WarFightRecord.champion_id

        stmt = (
            select(
                champion_id_col,
                Champion.name.label("champion_name"),
                Champion.image_url,
                cast(func.count(WarFightRecord.id), Integer).label("fight_count"),
                cast(func.sum(WarFightRecord.ko_count), Integer).label("total_kos"),
            )
            .join(Champion, champion_join)
            .join(Season, Season.id == WarFightRecord.season_id)
            .join(GameAccount, GameAccount.id == WarFightRecord.game_account_id)
            .where(and_(*conditions))
            .group_by(group_by_col, Champion.name, Champion.image_url)
            .order_by(func.count(WarFightRecord.id).desc())
        )
        rows = (await session.exec(stmt)).mappings().all()
        return [ChampionUsageResponse.model_validate(dict(row)) for row in rows]

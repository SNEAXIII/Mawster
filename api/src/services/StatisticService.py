import uuid

from src.models import User
from src.models import ChampionUser, Season, War, WarDefensePlacement, GameAccount
from src.models.War import WarStatus
from sqlalchemy import and_, func, cast, Integer, case
from sqlmodel import select

from src.dto.dto_statistic import PlayerSeasonStatsResponse
from src.services.AllianceService import AllianceService
from src.utils.db import SessionDep


_miniboss_case = case((WarDefensePlacement.node_number.between(37, 49), 1), else_=0)
_boss_case = case((WarDefensePlacement.node_number == 50, 1), else_=0)
_total_kos = func.sum(WarDefensePlacement.ko_count)
_total_fights = func.count()


class StatisticService:
    @classmethod
    async def get_active_season_statistics(
        cls, session: SessionDep, current_user: User, alliance_id: uuid.UUID
    ) -> list[PlayerSeasonStatsResponse]:
        await AllianceService.assert_is_alliance_member(session, current_user, alliance_id)

        sql = (
            select(
                GameAccount.id,
                GameAccount.game_pseudo,
                GameAccount.alliance_group,
                cast(_total_kos, Integer).label("total_kos"),
                _total_fights.label("total_fights"),
                cast(func.sum(_miniboss_case), Integer).label("total_miniboss"),
                cast(func.sum(_boss_case), Integer).label("total_boss"),
                cast((1 - _total_kos / _total_fights) * 100, Integer).label("ratio"),
                cast(
                    func.ifnull(1 - _total_kos / func.nullif(func.sum(_miniboss_case), 0), 0) * 100,
                    Integer,
                ).label("ratio_mb"),
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
        rows = (await session.exec(sql)).all()
        return [PlayerSeasonStatsResponse.model_validate(row) for row in rows]

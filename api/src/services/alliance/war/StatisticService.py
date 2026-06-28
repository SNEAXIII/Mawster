import uuid
from typing import Optional

from fastapi import HTTPException
from starlette import status

from src.models import User
from src.models import ChampionUser, Season, War, WarDefensePlacement, GameAccount
from src.models.Alliance import Alliance
from src.models.Champion import Champion
from src.models.War import WarStatus
from src.enums.SeasonStatus import SeasonStatus
from src.models.WarFightRecord import WarFightRecord
from sqlalchemy import and_, func, cast, Integer, Float, case, union
from sqlmodel import select

from src.dto.alliance.war.dto_statistic import (
    NOT_FOUGHT_KOS,
    ChampionUsageResponse,
    PlayerSeasonStatsResponse,
)
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
_fight_weight = case((_is_normal, 1.0), else_=0)
_weighted_fight_weight = case(
    (and_(_is_normal, _is_assisted), 0.5),
    (and_(_is_normal, ~_is_assisted), 1.0),
    else_=0,
)
_total_kos = func.sum(case((_is_normal, WarDefensePlacement.ko_count), else_=0))
_total_fights = func.sum(_fight_weight)
_total_weighted_fights = func.sum(_weighted_fight_weight)
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

        assist_sq = (
            select(
                ChampionUser.game_account_id.label("game_account_id"),
                func.count(WarDefensePlacement.id).label("total_assists"),
                cast(func.count(WarDefensePlacement.id) * 0.5, Float).label("assist_fights"),
            )
            .join(
                WarDefensePlacement, WarDefensePlacement.assist_champion_user_id == ChampionUser.id
            )
            .join(War, WarDefensePlacement.war_id == War.id)
            .join(Season, and_(War.season_id == Season.id, Season.status == SeasonStatus.active))
            .where(War.alliance_id == alliance_id)
            .where(War.status == WarStatus.ended)
            .group_by(ChampionUser.game_account_id)
            .subquery()
        )

        attacker_sq = (
            select(
                GameAccount.id.label("game_account_id"),
                cast(_total_kos, Integer).label("total_kos"),
                cast(_total_fights, Float).label("attack_fights"),
                cast(_total_weighted_fights, Float).label("attack_weighted_fights"),
                cast(func.sum(_miniboss_case), Integer).label("total_miniboss"),
                cast(func.sum(_boss_case), Integer).label("total_boss"),
                cast(_total_not_fought, Integer).label("total_not_fought"),
                cast(func.sum(case((and_(_is_normal, _is_assisted), 1), else_=0)), Integer).label(
                    "total_times_helped"
                ),
            )
            .join(ChampionUser, ChampionUser.game_account_id == GameAccount.id)
            .join(
                WarDefensePlacement,
                WarDefensePlacement.attacker_champion_user_id == ChampionUser.id,
            )
            .join(War, WarDefensePlacement.war_id == War.id)
            .join(Season, and_(War.season_id == Season.id, Season.status == SeasonStatus.active))
            .where(War.alliance_id == alliance_id)
            .where(War.status == WarStatus.ended)
            .group_by(GameAccount.id)
            .subquery()
        )

        # Distinct (game_account_id, war_id) pairs across attackers and assistors.
        # UNION deduplicates shared wars. Used both as participant filter and wars_participated.
        _war_pairs = union(
            select(GameAccount.id.label("game_account_id"), War.id.label("war_id"))
            .join(ChampionUser, ChampionUser.game_account_id == GameAccount.id)
            .join(
                WarDefensePlacement,
                WarDefensePlacement.attacker_champion_user_id == ChampionUser.id,
            )
            .join(War, WarDefensePlacement.war_id == War.id)
            .join(Season, and_(War.season_id == Season.id, Season.status == SeasonStatus.active))
            .where(War.alliance_id == alliance_id)
            .where(War.status == WarStatus.ended),
            select(ChampionUser.game_account_id.label("game_account_id"), War.id.label("war_id"))
            .join(
                WarDefensePlacement, WarDefensePlacement.assist_champion_user_id == ChampionUser.id
            )
            .join(War, WarDefensePlacement.war_id == War.id)
            .join(Season, and_(War.season_id == Season.id, Season.status == SeasonStatus.active))
            .where(War.alliance_id == alliance_id)
            .where(War.status == WarStatus.ended),
        ).subquery()
        wars_sq = (
            select(
                _war_pairs.c.game_account_id,
                func.count(_war_pairs.c.war_id).label("wars_participated"),
            )
            .group_by(_war_pairs.c.game_account_id)
            .subquery()
        )

        _combined_fights = func.coalesce(attacker_sq.c.attack_fights, 0)
        _combined_weighted_fights = func.coalesce(
            attacker_sq.c.attack_weighted_fights, 0
        ) + func.coalesce(assist_sq.c.assist_fights, 0)
        _kos = func.coalesce(attacker_sq.c.total_kos, 0)
        _not_fought = func.coalesce(attacker_sq.c.total_not_fought, 0)
        # Each not-done fight counts as a fight with NOT_FOUGHT_KOS KOs in the
        # ratio, so skipping a node penalizes the player just like in the score.
        _ratio_kos = _kos + NOT_FOUGHT_KOS * _not_fought
        _ratio_fights = _combined_fights + _not_fought
        _wars = wars_sq.c.wars_participated

        sql = (
            select(
                GameAccount.id,
                GameAccount.game_pseudo,
                GameAccount.alliance_group,
                cast(_kos, Integer).label("total_kos"),
                cast(_combined_fights, Float).label("total_fights"),
                cast(_combined_weighted_fights, Float).label("total_fights_weighted"),
                cast(func.coalesce(assist_sq.c.total_assists, 0), Integer).label("total_assists"),
                cast(func.coalesce(attacker_sq.c.total_times_helped, 0), Integer).label(
                    "total_times_helped"
                ),
                cast(func.coalesce(attacker_sq.c.total_miniboss, 0), Integer).label(
                    "total_miniboss"
                ),
                cast(func.coalesce(attacker_sq.c.total_boss, 0), Integer).label("total_boss"),
                cast(func.coalesce(attacker_sq.c.total_not_fought, 0), Integer).label(
                    "total_not_fought"
                ),
                cast(
                    func.coalesce((1 - _ratio_kos / func.nullif(_ratio_fights, 0)) * 100, 100),
                    Integer,
                ).label("ratio"),
                cast(_wars, Integer).label("wars_participated"),
                cast(_combined_fights / func.nullif(_wars, 0), Float).label("avg_fights_per_war"),
                cast(
                    cast(
                        func.coalesce(attacker_sq.c.total_miniboss, 0)
                        + func.coalesce(attacker_sq.c.total_boss, 0),
                        Float,
                    )
                    / func.nullif(_wars, 0),
                    Float,
                ).label("avg_boss_miniboss_per_war"),
                case((GameAccount.alliance_id == alliance_id, True), else_=False).label(
                    "is_current_member"
                ),
            )
            .join(wars_sq, wars_sq.c.game_account_id == GameAccount.id)
            .outerjoin(attacker_sq, attacker_sq.c.game_account_id == GameAccount.id)
            .outerjoin(assist_sq, assist_sq.c.game_account_id == GameAccount.id)
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
            Season.status == SeasonStatus.active,
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

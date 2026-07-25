import uuid

from fastapi import HTTPException
from sqlalchemy import Float, Integer, and_, case, cast, func, union
from sqlmodel import select
from starlette import status

from src.dto.alliance.war.dto_statistic import (
    NOT_FOUGHT_KOS,
    ChampionUsageResponse,
    PlayerSeasonStatsResponse,
)
from src.models import ChampionUser, GameAccount, User, War, WarDefensePlacement
from src.models.Alliance import Alliance
from src.models.Champion import Champion
from src.models.War import WarStatus
from src.models.WarFightRecord import WarFightRecord
from src.services.alliance.AllianceService import AllianceService
from src.services.alliance.war._stat_expressions import (
    boss_case,
    is_assisted,
    is_normal,
    miniboss_case,
    total_fights,
    total_kos,
    total_not_fought,
    total_weighted_fights,
)
from src.services.SeasonService import SeasonService
from src.utils.db import SessionDep


class StatisticService:
    @classmethod
    async def get_display_season_statistics(
        cls, session: SessionDep, current_user: User, alliance_id: uuid.UUID
    ) -> list[PlayerSeasonStatsResponse]:
        alliance = await session.get(Alliance, alliance_id)
        if alliance is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alliance not found")
        if not await AllianceService.is_visitor(session, current_user.id, alliance_id):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alliance not found")

        display_season = await SeasonService.get_display_season(session)
        if display_season is None:
            return []
        season_id = display_season.id

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
            .where(War.season_id == season_id)
            .where(War.alliance_id == alliance_id)
            .where(War.status == WarStatus.ended)
            .group_by(ChampionUser.game_account_id)
            .subquery()
        )

        attacker_sq = (
            select(
                GameAccount.id.label("game_account_id"),
                cast(total_kos, Integer).label("total_kos"),
                cast(total_fights, Float).label("attack_fights"),
                cast(total_weighted_fights, Float).label("attack_weighted_fights"),
                cast(func.sum(miniboss_case), Integer).label("total_miniboss"),
                cast(func.sum(boss_case), Integer).label("total_boss"),
                cast(total_not_fought, Integer).label("total_not_fought"),
                cast(func.sum(case((and_(is_normal, is_assisted), 1), else_=0)), Integer).label(
                    "total_times_helped"
                ),
            )
            .join(ChampionUser, ChampionUser.game_account_id == GameAccount.id)
            .join(
                WarDefensePlacement,
                WarDefensePlacement.attacker_champion_user_id == ChampionUser.id,
            )
            .join(War, WarDefensePlacement.war_id == War.id)
            .where(War.season_id == season_id)
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
            .where(War.season_id == season_id)
            .where(War.alliance_id == alliance_id)
            .where(War.status == WarStatus.ended),
            select(ChampionUser.game_account_id.label("game_account_id"), War.id.label("war_id"))
            .join(
                WarDefensePlacement, WarDefensePlacement.assist_champion_user_id == ChampionUser.id
            )
            .join(War, WarDefensePlacement.war_id == War.id)
            .where(War.season_id == season_id)
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
        game_account_id: uuid.UUID | None = None,
        war_id: uuid.UUID | None = None,
        alliance_group: int | None = None,
        deathless: bool | None = None,
        perspective: str = "attacker",
    ) -> list[ChampionUsageResponse]:
        alliance = await session.get(Alliance, alliance_id)
        if alliance is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alliance not found")
        if not await AllianceService.is_visitor(session, current_user.id, alliance_id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

        display_season = await SeasonService.get_display_season(session)
        if display_season is None:
            return []

        conditions = [
            WarFightRecord.alliance_id == alliance_id,
            WarFightRecord.season_id == display_season.id,
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
            .join(GameAccount, GameAccount.id == WarFightRecord.game_account_id)
            .where(and_(*conditions))
            .group_by(group_by_col, Champion.name, Champion.image_url)
            .order_by(func.count(WarFightRecord.id).desc())
        )
        rows = (await session.exec(stmt)).mappings().all()
        return [ChampionUsageResponse.model_validate(dict(row)) for row in rows]

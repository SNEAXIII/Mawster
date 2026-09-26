"""Shared SQL expressions for war stats. Single source of truth for the ratio
formula so alliance and player stats never diverge."""

from sqlalchemy import Float, and_, case, cast, func

from src.dto.alliance.war.dto_statistic import NOT_FOUGHT_KOS
from src.models.war.WarDefensePlacement import WarDefensePlacement

is_normal = and_(
    WarDefensePlacement.is_fight_not_done.is_(False),
    WarDefensePlacement.is_planning_error.is_(False),
)
is_not_done = and_(
    WarDefensePlacement.is_fight_not_done.is_(True),
    WarDefensePlacement.is_planning_error.is_(False),
)
miniboss_case = case((and_(is_normal, WarDefensePlacement.node_number.between(37, 49)), 1), else_=0)
boss_case = case((and_(is_normal, WarDefensePlacement.node_number == 50), 1), else_=0)
is_assisted = WarDefensePlacement.assist_champion_user_id.is_not(None)
fight_weight = case((is_normal, 1.0), else_=0)
weighted_fight_weight = case(
    (and_(is_normal, is_assisted), 0.5),
    (and_(is_normal, ~is_assisted), 1.0),
    else_=0,
)
total_kos = func.sum(case((is_normal, WarDefensePlacement.ko_count), else_=0))
total_fights = func.sum(fight_weight)
total_weighted_fights = func.sum(weighted_fight_weight)
total_not_fought = func.sum(case((is_not_done, 1), else_=0))


def ratio_percent(kos, fights, not_fought):
    """Survival ratio in %, 100 with no fight; a not-done fight counts as NOT_FOUGHT_KOS KOs."""
    ratio_kos = kos + NOT_FOUGHT_KOS * not_fought
    ratio_fights = fights + not_fought
    return cast(
        func.round(func.coalesce((1 - ratio_kos / func.nullif(ratio_fights, 0)) * 100, 100), 1),
        Float,
    )

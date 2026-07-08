"""Shared SQL expressions for war stats. Single source of truth for the ratio
formula so alliance and player stats never diverge."""

from sqlalchemy import and_, func, case
from src.models.WarDefensePlacement import WarDefensePlacement

is_normal = and_(
    WarDefensePlacement.is_fight_not_done == False,  # noqa: E712
    WarDefensePlacement.is_planning_error == False,  # noqa: E712
)
is_not_done = and_(
    WarDefensePlacement.is_fight_not_done == True,  # noqa: E712
    WarDefensePlacement.is_planning_error == False,  # noqa: E712
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

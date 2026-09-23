"""Win streak: a Player's latest fights in a row without a KO."""

from collections.abc import Iterable
from typing import NamedTuple


class StreakFight(NamedTuple):
    ko_count: int
    is_fight_not_done: bool


def current_win_streak(fights_newest_first: Iterable[StreakFight]) -> int:
    streak = 0
    for fight in fights_newest_first:
        if fight.ko_count > 0 or fight.is_fight_not_done:
            break
        streak += 1
    return streak

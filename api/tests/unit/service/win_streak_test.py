"""Unit tests for the pure win streak counter (no database)."""

import pytest

from src.services.alliance.war._win_streak import StreakFight, current_win_streak

CLEAN = StreakFight(ko_count=0, is_fight_not_done=False)
KO = StreakFight(ko_count=1, is_fight_not_done=False)
NOT_DONE = StreakFight(ko_count=0, is_fight_not_done=True)


def test_no_fight_is_zero():
    assert current_win_streak([]) == 0


def test_all_clean_counts_every_fight():
    assert current_win_streak([CLEAN, CLEAN, CLEAN]) == 3


def test_ko_on_latest_fight_is_zero():
    assert current_win_streak([KO, CLEAN, CLEAN]) == 0


def test_counts_only_fights_after_the_latest_ko():
    # newest first: node 3 clean, node 2 KO, node 1 clean
    assert current_win_streak([CLEAN, KO, CLEAN]) == 1


def test_ko_on_oldest_fight_keeps_the_rest():
    assert current_win_streak([CLEAN, CLEAN, KO]) == 2


def test_not_done_breaks_like_a_ko():
    assert current_win_streak([CLEAN, NOT_DONE, CLEAN]) == 1


def test_not_done_on_latest_fight_is_zero():
    assert current_win_streak([NOT_DONE]) == 0


@pytest.mark.parametrize("ko_count", [1, 2, 5])
def test_any_ko_count_breaks(ko_count):
    fights = [CLEAN, StreakFight(ko_count=ko_count, is_fight_not_done=False), CLEAN]
    assert current_win_streak(fights) == 1


def test_not_done_with_ko_breaks_once():
    both = StreakFight(ko_count=2, is_fight_not_done=True)
    assert current_win_streak([CLEAN, CLEAN, both, CLEAN]) == 2


def test_accepts_a_generator():
    assert current_win_streak(f for f in [CLEAN, CLEAN, KO]) == 2

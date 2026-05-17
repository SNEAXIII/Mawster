"""Unit tests for PlayerSeasonStatsResponse.score computed field."""

import uuid

from src.dto.alliance.war.dto_statistic import PlayerSeasonStatsResponse

# KO=-10 FIGHT=2 MINIBOSS=4 BOSS=5 NOT_FOUGHT_KOS=3 HELPED=-2 ASSIST=2


def _make(**kwargs) -> PlayerSeasonStatsResponse:
    defaults = {
        "id": uuid.uuid4(),
        "game_pseudo": "Player",
        "alliance_group": None,
        "total_kos": 0,
        "total_fights": 0.0,
        "total_assists": 0,
        "total_times_helped": 0,
        "total_miniboss": 0,
        "total_boss": 0,
        "total_not_fought": 0,
        "ratio": 100,
        "wars_participated": 1,
        "avg_fights_per_war": 0.0,
        "avg_boss_miniboss_per_war": 0.0,
        "is_current_member": True,
    }
    defaults.update(kwargs)
    return PlayerSeasonStatsResponse(**defaults)


class TestScoreFormula:
    def test_all_zeros(self):
        assert _make(wars_participated=0).score == 0

    def test_regular_fights_no_kos(self):
        # 2 fights, 0 KOs → 0*(-10) + 2*2 = 4
        s = _make(total_fights=2.0)
        assert s.score == 4

    def test_regular_fights_with_kos(self):
        # 2 fights, 1 KO → 1*(-10) + 2*2 = -6
        s = _make(total_fights=2.0, total_kos=1)
        assert s.score == -6

    def test_assist_given_earns_2_points(self):
        # Assistor has no fights, 1 assist → score = ASSIST(2) = 2
        s = _make(total_fights=0.0, total_assists=1)
        assert s.score == 2

    def test_two_assists_earn_4_points(self):
        # 2 assists, no fights → score = 2*ASSIST(2) = 4
        s = _make(total_fights=0.0, total_assists=2)
        assert s.score == 4

    def test_assisted_fight_received_score(self):
        # Attacker received assist: full fight (1.0), total_times_helped=1
        # fights=1.0 → 1.0*2 + HELPED(-2) = 2 - 2 = 0
        s = _make(total_fights=1.0, total_times_helped=1)
        assert s.score == 0

    def test_assisted_fight_with_ko(self):
        # Attacker received assist, got KO: total_fights=1.0, total_times_helped=1, total_kos=1
        # fights=1.0 → 1*(-10) + 1.0*2 + HELPED(-2) = -10+2-2 = -10
        s = _make(total_fights=1.0, total_kos=1, total_times_helped=1)
        assert s.score == -10

    def test_mixed_normal_and_assisted_fights(self):
        # 2 fights (1 normal + 1 assisted received): total_fights=2.0, total_times_helped=1, 0 KOs
        # fights=2.0 → 2.0*2 + HELPED(-2) = 4 - 2 = 2
        s = _make(total_fights=2.0, total_times_helped=1)
        assert s.score == 2

    def test_miniboss_and_boss_score(self):
        # 1 regular + 1 miniboss + 1 boss, 0 KOs
        # fights = 3 - 1 - 1 - 0 = 1 → 1*2 + 1*4 + 1*5 = 11
        s = _make(total_fights=3.0, total_miniboss=1, total_boss=1)
        assert s.score == 11

    def test_not_fought_penalty(self):
        # 1 not_fought → 1 * 3 * (-10) = -30
        s = _make(total_not_fought=1)
        assert s.score == -30

    def test_assist_and_fight_combined(self):
        # 1 normal fight + 2 assists given: total_fights=1.0, total_assists=2
        # fights=1.0 → 1.0*2 + 2*ASSIST(2) = 2 + 4 = 6
        s = _make(total_fights=1.0, total_assists=2)
        assert s.score == 6

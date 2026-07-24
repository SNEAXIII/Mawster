"""Unit tests for RankingHistoryService._reconstruct_elo logic."""

import uuid

from src.models.War import War, WarStatus
from src.services.alliance.RankingHistoryService import RankingHistoryService


def _war(
    opponent: str, elo_change: int | None, win: bool | None = True, tier: int | None = 5
) -> War:
    return War(
        id=uuid.uuid4(),
        alliance_id=uuid.uuid4(),
        opponent_name=opponent,
        created_by_id=uuid.uuid4(),
        status=WarStatus.ended,
        elo_change=elo_change,
        win=win,
        tier=tier,
    )


class TestReconstructElo:
    def test_empty_wars_returns_empty(self):
        assert RankingHistoryService._reconstruct_elo([], current_elo=3000) == []

    def test_single_war_elo_after_equals_current(self):
        wars = [_war("Enemy", elo_change=50)]
        points = RankingHistoryService._reconstruct_elo(wars, current_elo=3000)
        assert len(points) == 1
        assert points[0].elo_after == 3000
        assert points[0].war_number == 1
        assert points[0].opponent_name == "Enemy"

    def test_multiple_wars_reconstruct_correctly(self):
        wars = [
            _war("Alpha", elo_change=50),
            _war("Beta", elo_change=-30),
            _war("Gamma", elo_change=80),
        ]
        points = RankingHistoryService._reconstruct_elo(wars, current_elo=3000)
        assert len(points) == 3
        # Gamma is last → elo_after=3000
        # Beta → 3000-80=2920
        # Alpha → 2920-(-30)=2950
        assert points[0].elo_after == 2950
        assert points[1].elo_after == 2920
        assert points[2].elo_after == 3000

    def test_war_numbers_are_sequential(self):
        wars = [_war("A", 10), _war("B", 20), _war("C", 30)]
        points = RankingHistoryService._reconstruct_elo(wars, current_elo=1000)
        assert [p.war_number for p in points] == [1, 2, 3]

    def test_null_elo_change_treated_as_zero(self):
        wars = [_war("Alpha", elo_change=None), _war("Beta", elo_change=100)]
        points = RankingHistoryService._reconstruct_elo(wars, current_elo=2000)
        # Beta last → 2000; Alpha → 2000-100=1900
        assert points[0].elo_after == 1900
        assert points[1].elo_after == 2000

    def test_tier_and_win_preserved(self):
        wars = [_war("Foe", elo_change=50, win=False, tier=3)]
        points = RankingHistoryService._reconstruct_elo(wars, current_elo=500)
        assert points[0].tier == 3
        assert points[0].win is False

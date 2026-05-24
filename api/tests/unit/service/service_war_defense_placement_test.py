"""Unit tests for war placement DTO rank validation (7r6 support)."""

import uuid

import pytest
from pydantic import ValidationError

from src.dto.alliance.war.dto_war import WarPlacementCreateRequest


def _make_request(**overrides) -> WarPlacementCreateRequest:
    defaults = {
        "node_number": 10,
        "champion_id": uuid.uuid4(),
        "stars": 7,
        "rank": 1,
        "ascension": 0,
    }
    return WarPlacementCreateRequest(**{**defaults, **overrides})


class TestWarPlacementCreateRequestRank:
    def test_rank_6_accepted(self):
        """7r6 is the new max — rank=6 must be accepted by the DTO."""
        req = _make_request(rank=6)
        assert req.rank == 6

    def test_rank_5_still_accepted(self):
        req = _make_request(rank=5)
        assert req.rank == 5

    def test_rank_7_rejected(self):
        """rank > 6 must raise ValidationError."""
        with pytest.raises(ValidationError):
            _make_request(rank=7)

    def test_rank_0_rejected(self):
        """rank < 1 must raise ValidationError."""
        with pytest.raises(ValidationError):
            _make_request(rank=0)

    @pytest.mark.parametrize("rank", [1, 2, 3, 4, 5, 6])
    def test_all_valid_ranks_accepted(self, rank):
        req = _make_request(rank=rank)
        assert req.rank == rank

    def test_rarity_string_7r6(self):
        """Verify that stars=7 rank=6 produces rarity string '7r6'."""
        req = _make_request(stars=7, rank=6)
        assert f"{req.stars}r{req.rank}" == "7r6"

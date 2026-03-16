"""Unit tests for WarService – business rules without DB."""
import uuid

import pytest

from src.dto.dto_war import WarPlacementCreateRequest


# ─── WarPlacementCreateRequest validation ─────────────────

class TestWarPlacementCreateRequest:
    def test_valid_7r3(self):
        req = WarPlacementCreateRequest(
            node_number=10,
            champion_id=uuid.uuid4(),
            stars=7,
            rank=3,
            ascension=0,
        )
        assert req.stars == 7
        assert req.rank == 3
        assert req.ascension == 0

    def test_valid_6r4(self):
        req = WarPlacementCreateRequest(
            node_number=1,
            champion_id=uuid.uuid4(),
            stars=6,
            rank=4,
        )
        assert req.stars == 6

    def test_node_number_min(self):
        req = WarPlacementCreateRequest(
            node_number=1,
            champion_id=uuid.uuid4(),
            stars=7,
            rank=3,
        )
        assert req.node_number == 1

    def test_node_number_max(self):
        req = WarPlacementCreateRequest(
            node_number=55,
            champion_id=uuid.uuid4(),
            stars=7,
            rank=3,
        )
        assert req.node_number == 55

    def test_node_number_too_low_raises(self):
        with pytest.raises(Exception):
            WarPlacementCreateRequest(
                node_number=0,
                champion_id=uuid.uuid4(),
                stars=7,
                rank=3,
            )

    def test_node_number_too_high_raises(self):
        with pytest.raises(Exception):
            WarPlacementCreateRequest(
                node_number=56,
                champion_id=uuid.uuid4(),
                stars=7,
                rank=3,
            )

    def test_stars_below_6_raises(self):
        with pytest.raises(Exception):
            WarPlacementCreateRequest(
                node_number=10,
                champion_id=uuid.uuid4(),
                stars=5,
                rank=3,
            )

    def test_stars_above_7_raises(self):
        with pytest.raises(Exception):
            WarPlacementCreateRequest(
                node_number=10,
                champion_id=uuid.uuid4(),
                stars=8,
                rank=3,
            )

    def test_rank_below_1_raises(self):
        with pytest.raises(Exception):
            WarPlacementCreateRequest(
                node_number=10,
                champion_id=uuid.uuid4(),
                stars=7,
                rank=0,
            )

    def test_rank_above_5_raises(self):
        with pytest.raises(Exception):
            WarPlacementCreateRequest(
                node_number=10,
                champion_id=uuid.uuid4(),
                stars=7,
                rank=6,
            )

    def test_ascension_defaults_to_zero(self):
        req = WarPlacementCreateRequest(
            node_number=10,
            champion_id=uuid.uuid4(),
            stars=7,
            rank=3,
        )
        assert req.ascension == 0

    def test_ascension_max_2(self):
        req = WarPlacementCreateRequest(
            node_number=10,
            champion_id=uuid.uuid4(),
            stars=7,
            rank=3,
            ascension=2,
        )
        assert req.ascension == 2

    def test_ascension_above_2_raises(self):
        with pytest.raises(Exception):
            WarPlacementCreateRequest(
                node_number=10,
                champion_id=uuid.uuid4(),
                stars=7,
                rank=3,
                ascension=3,
            )

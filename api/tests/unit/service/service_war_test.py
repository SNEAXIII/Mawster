"""Unit tests for WarService – business rules without DB."""

import uuid

import pytest

from src.dto.dto_war import WarPlacementCreateRequest, WarSynergyCreateRequest


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


# ─── WarSynergyCreateRequest validation ───────────────────


class TestWarSynergyCreateRequest:
    def test_valid_request(self):
        req = WarSynergyCreateRequest(
            champion_user_id=uuid.uuid4(),
            target_champion_user_id=uuid.uuid4(),
        )
        assert req.champion_user_id is not None
        assert req.target_champion_user_id is not None

    def test_missing_champion_user_id_raises(self):
        with pytest.raises(Exception):
            WarSynergyCreateRequest(target_champion_user_id=uuid.uuid4())  # type: ignore[call-arg]

    def test_missing_target_raises(self):
        with pytest.raises(Exception):
            WarSynergyCreateRequest(champion_user_id=uuid.uuid4())  # type: ignore[call-arg]


# ─── Slot counting logic (pure set union) ─────────────────


def _count_slots(node_ids: set, synergy_ids: set, new_id=None) -> int:
    """Mirrors the service's slot-counting union logic."""
    combined = node_ids | synergy_ids
    if new_id is not None:
        combined = combined | {new_id}
    return len(combined)


class TestSynergySlotCounting:
    def test_node_only_one_slot(self):
        node_id = uuid.uuid4()
        assert _count_slots({node_id}, set()) == 1

    def test_synergy_only_one_slot(self):
        synergy_id = uuid.uuid4()
        assert _count_slots(set(), {synergy_id}) == 1

    def test_node_and_synergy_two_slots(self):
        node_id = uuid.uuid4()
        synergy_id = uuid.uuid4()
        assert _count_slots({node_id}, {synergy_id}) == 2

    def test_couteau_suisse_counts_as_one_slot(self):
        """Same champion on a node AND as synergy provider counts once."""
        couteau_id = uuid.uuid4()
        assert _count_slots({couteau_id}, {couteau_id}) == 1

    def test_three_node_attackers_at_limit(self):
        ids = {uuid.uuid4(), uuid.uuid4(), uuid.uuid4()}
        assert _count_slots(ids, set()) == 3

    def test_two_node_one_synergy_at_limit(self):
        n1, n2, s1 = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
        assert _count_slots({n1, n2}, {s1}) == 3

    def test_couteau_suisse_allows_third_slot(self):
        """Couteau suisse + 1 node + 1 synergy-only = 3 unique slots (not 4)."""
        couteau_id = uuid.uuid4()
        other_node = uuid.uuid4()
        other_synergy = uuid.uuid4()
        assert _count_slots({couteau_id, other_node}, {couteau_id, other_synergy}) == 3

    def test_adding_fourth_exceeds_limit(self):
        n1, n2, n3 = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
        fourth = uuid.uuid4()
        total = _count_slots({n1, n2, n3}, set(), new_id=fourth)
        assert total > 3

    def test_adding_existing_as_synergy_stays_at_limit(self):
        """Adding couteau suisse as synergy when it's already a node attacker stays at 3."""
        n1, n2, n3 = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
        total = _count_slots({n1, n2, n3}, set(), new_id=n1)
        assert total == 3

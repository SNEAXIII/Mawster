"""Unit tests for TierListSaveRequest DTO validation."""

import uuid

import pytest
from pydantic import ValidationError

from src.dto.account.dto_tierlist import MAX_TIERS_PER_LIST, TierListSaveRequest


def _tier(champion_ids: list[uuid.UUID] | None = None, label: str = "S") -> dict:
    return {"label": label, "color": "#ff0000", "champion_ids": champion_ids or []}


class TestTierListSaveRequestValid:
    def test_valid_payload(self):
        champion_id = uuid.uuid4()
        request = TierListSaveRequest(tiers=[_tier([champion_id])])
        assert request.tiers[0].champion_ids == [champion_id]

    def test_title_defaults_to_empty_string(self):
        request = TierListSaveRequest(tiers=[_tier()])
        assert request.title == ""


class TestTierListSaveRequestDuplicates:
    def test_champion_ranked_in_two_tiers_raises(self):
        champion_id = uuid.uuid4()
        tiers = [_tier([champion_id], label="S"), _tier([champion_id], label="A")]

        with pytest.raises(ValidationError):
            TierListSaveRequest(tiers=tiers)

    def test_champion_ranked_twice_in_same_tier_raises(self):
        champion_id = uuid.uuid4()
        tiers = [_tier([champion_id, champion_id])]

        with pytest.raises(ValidationError):
            TierListSaveRequest(tiers=tiers)

    def test_champion_tagged_twice_raises(self):
        champion_id = uuid.uuid4()
        tags = [{"champion_id": champion_id}, {"champion_id": champion_id}]
        tiers = [_tier()]

        with pytest.raises(ValidationError):
            TierListSaveRequest(tiers=tiers, tags=tags)

    def test_same_champion_ranked_and_tagged_is_allowed(self):
        champion_id = uuid.uuid4()
        request = TierListSaveRequest(
            tiers=[_tier([champion_id])], tags=[{"champion_id": champion_id}]
        )
        assert request.tags[0].champion_id == champion_id


class TestTierListSaveRequestTierBounds:
    def test_empty_tiers_raises(self):
        with pytest.raises(ValidationError):
            TierListSaveRequest(tiers=[])

    def test_max_tiers_accepted(self):
        tiers = [_tier(label=str(i)) for i in range(MAX_TIERS_PER_LIST)]

        request = TierListSaveRequest(tiers=tiers)

        assert len(request.tiers) == MAX_TIERS_PER_LIST

    def test_above_max_tiers_raises(self):
        tiers = [_tier(label=str(i)) for i in range(MAX_TIERS_PER_LIST + 1)]

        with pytest.raises(ValidationError):
            TierListSaveRequest(tiers=tiers)

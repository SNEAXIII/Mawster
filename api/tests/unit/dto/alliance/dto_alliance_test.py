"""Unit tests for alliance DTOs."""

import uuid
from unittest.mock import MagicMock

import pytest
from pydantic import ValidationError

from src.dto.alliance.dto_alliance import AllianceCreateRequest, AllianceResponse
from src.models.Base import utcnow


class TestAllianceCreateRequest:
    def test_valid(self):
        dto = AllianceCreateRequest(name="My Alliance", tag="ALLY", owner_id=uuid.uuid4())
        assert dto.name == "My Alliance"
        assert dto.tag == "ALLY"

    def test_valid_no_space(self):
        dto = AllianceCreateRequest(name="MyAlliance", tag="MAW", owner_id=uuid.uuid4())
        assert dto.name == "MyAlliance"

    def test_accepts_special_chars(self):
        dto = AllianceCreateRequest(name="Ŧhé-Ållîance ★!", tag="Ø★_é", owner_id=uuid.uuid4())
        assert dto.name == "Ŧhé-Ållîance ★!"
        assert dto.tag == "Ø★_é"

    def test_strips_surrounding_whitespace(self):
        dto = AllianceCreateRequest(name="  MyAlliance ", tag=" MAW ", owner_id=uuid.uuid4())
        assert (dto.name, dto.tag) == ("MyAlliance", "MAW")

    def test_name_rejects_more_than_25_chars(self):
        owner_id = uuid.uuid4()

        with pytest.raises(ValidationError):
            AllianceCreateRequest(name="A" * 26, tag="ALLY", owner_id=owner_id)

    @pytest.mark.parametrize(
        ("name", "tag"),
        [
            ("My🔥Alliance", "ALLY"),
            ("MyAlliance", "A❤️"),
            ("MyAlliance", "🇫🇷"),
            ("MyAlliance", "1️⃣"),
            ("MyAlliance", "A\u200dB"),
        ],
    )
    def test_rejects_emoji(self, name, tag):
        owner_id = uuid.uuid4()

        with pytest.raises(ValidationError):
            AllianceCreateRequest(name=name, tag=tag, owner_id=owner_id)

    def test_name_rejects_control_chars(self):
        owner_id = uuid.uuid4()

        with pytest.raises(ValidationError):
            AllianceCreateRequest(name="My\nAlliance", tag="ALLY", owner_id=owner_id)

    def test_tag_accepts_spaces(self):
        dto = AllianceCreateRequest(name="MyAlliance", tag="AL Y", owner_id=uuid.uuid4())
        assert dto.tag == "AL Y"


def _make_alliance(elo: int = 1500, tier: int = 8):
    a = MagicMock()
    a.id = uuid.uuid4()
    a.name = "TestAlliance"
    a.tag = "TEST"
    a.owner_id = uuid.uuid4()
    a.created_at = utcnow()
    a.elo = elo
    a.tier = tier
    a.owner = MagicMock(game_pseudo="owner")
    a.officers = []
    a.members = []
    return a


def test_alliance_response_includes_elo_and_tier():
    a = _make_alliance(elo=1200, tier=5)
    resp = AllianceResponse.model_validate(a)
    assert resp.elo == 1200
    assert resp.tier == 5


def test_alliance_response_defaults():
    a = _make_alliance(elo=0, tier=20)
    resp = AllianceResponse.model_validate(a)
    assert resp.elo == 0
    assert resp.tier == 20

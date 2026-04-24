"""Unit tests for alliance DTOs."""
import uuid
from datetime import datetime
from unittest.mock import MagicMock

from src.dto.dto_alliance import AllianceResponse


def _make_alliance(elo: int = 1500, tier: int = 8):
    a = MagicMock()
    a.id = uuid.uuid4()
    a.name = "TestAlliance"
    a.tag = "TEST"
    a.owner_id = uuid.uuid4()
    a.created_at = datetime.now()
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

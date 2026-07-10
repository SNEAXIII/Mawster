"""Unit tests for the pure matchup scoring helpers (no database)."""

import uuid

import pytest

from src.enums.MatchupTargetType import MatchupTargetType
from src.services.alliance.matchup_scoring import build_target_key


def test_build_target_key_for_defender():
    defender_id = uuid.UUID("11111111-1111-1111-1111-111111111111")
    key = build_target_key(MatchupTargetType.DEFENDER, defender_id, None)
    assert key == "def:11111111-1111-1111-1111-111111111111"


def test_build_target_key_for_node():
    key = build_target_key(MatchupTargetType.NODE, None, 23)
    assert key == "node:23"


def test_build_target_key_rejects_defender_without_id():
    with pytest.raises(ValueError):
        build_target_key(MatchupTargetType.DEFENDER, None, None)


def test_build_target_key_rejects_node_without_number():
    with pytest.raises(ValueError):
        build_target_key(MatchupTargetType.NODE, None, None)

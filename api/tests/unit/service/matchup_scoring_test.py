"""Unit tests for the pure matchup scoring helpers (no database)."""

import uuid

import pytest

from src.enums.MatchupTargetType import MatchupTargetType
from src.enums.MatchupVerdict import MatchupVerdict
from src.services.alliance.matchup_scoring import (
    build_target_key,
    combine_verdicts,
    format_instance_label,
    resolve_missing_champions,
)


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


def test_combine_verdicts_sums_points():
    assert combine_verdicts(MatchupVerdict.GOOD, MatchupVerdict.GOOD) == (False, 4)
    assert combine_verdicts(MatchupVerdict.GOOD, MatchupVerdict.OK) == (False, 3)
    assert combine_verdicts(MatchupVerdict.OK, MatchupVerdict.OK) == (False, 2)


def test_combine_verdicts_treats_missing_rating_as_zero():
    assert combine_verdicts(MatchupVerdict.GOOD, None) == (False, 2)
    assert combine_verdicts(None, MatchupVerdict.OK) == (False, 1)
    assert combine_verdicts(None, None) == (False, 0)


def test_combine_verdicts_short_circuits_on_discouraged_defender():
    assert combine_verdicts(MatchupVerdict.DISCOURAGED, MatchupVerdict.GOOD) == (True, None)


def test_combine_verdicts_short_circuits_on_discouraged_node():
    assert combine_verdicts(MatchupVerdict.GOOD, MatchupVerdict.DISCOURAGED) == (True, None)


def test_format_instance_label_includes_ascension_when_set():
    assert format_instance_label(7, 5, 2, 200) == "7r5 a2 sig 200"


def test_format_instance_label_omits_ascension_when_zero():
    assert format_instance_label(7, 3, 0, 0) == "7r3 sig 0"


def test_resolve_missing_champions_reports_unowned_champion():
    champ = uuid.uuid4()
    assert resolve_missing_champions(champ, [], set()) == [champ]


def test_resolve_missing_champions_reports_unowned_required_synergy():
    champ, synergy = uuid.uuid4(), uuid.uuid4()
    assert resolve_missing_champions(champ, [synergy], {champ}) == [synergy]


def test_resolve_missing_champions_returns_empty_when_everything_owned():
    champ, synergy = uuid.uuid4(), uuid.uuid4()
    assert resolve_missing_champions(champ, [synergy], {champ, synergy}) == []

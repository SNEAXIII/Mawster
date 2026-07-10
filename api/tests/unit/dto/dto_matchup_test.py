"""Unit tests for the matchup DTO validators."""

import uuid

import pytest
from pydantic import ValidationError

from src.dto.alliance.dto_matchup import MatchupTargetInput, MatchupUpsertRequest
from src.enums.MatchupTargetType import MatchupTargetType
from src.enums.MatchupVerdict import MatchupVerdict


def _defender_target(**overrides) -> dict:
    payload = {
        "target_type": MatchupTargetType.DEFENDER,
        "defender_champion_id": uuid.uuid4(),
        "verdict": MatchupVerdict.GOOD,
    }
    payload.update(overrides)
    return payload


def test_defender_target_accepts_a_defender_id():
    target = MatchupTargetInput(**_defender_target())
    assert target.node_number is None


def test_node_target_accepts_a_node_number():
    target = MatchupTargetInput(
        target_type=MatchupTargetType.NODE, node_number=23, verdict=MatchupVerdict.OK
    )
    assert target.defender_champion_id is None


def test_target_rejects_both_defender_and_node():
    with pytest.raises(ValidationError):
        MatchupTargetInput(**_defender_target(node_number=23))


def test_target_rejects_neither_defender_nor_node():
    with pytest.raises(ValidationError):
        MatchupTargetInput(target_type=MatchupTargetType.NODE, verdict=MatchupVerdict.OK)


def test_target_rejects_more_than_two_synergies():
    synergies = [{"champion_id": uuid.uuid4()} for _ in range(3)]
    with pytest.raises(ValidationError):
        MatchupTargetInput(**_defender_target(synergies=synergies))


def test_upsert_rejects_two_targets_of_the_same_type():
    with pytest.raises(ValidationError):
        MatchupUpsertRequest(
            champion_id=uuid.uuid4(),
            targets=[
                MatchupTargetInput(**_defender_target()),
                MatchupTargetInput(**_defender_target()),
            ],
        )


def test_upsert_accepts_one_defender_and_one_node():
    request = MatchupUpsertRequest(
        champion_id=uuid.uuid4(),
        targets=[
            MatchupTargetInput(**_defender_target()),
            MatchupTargetInput(
                target_type=MatchupTargetType.NODE, node_number=1, verdict=MatchupVerdict.GOOD
            ),
        ],
    )
    assert len(request.targets) == 2

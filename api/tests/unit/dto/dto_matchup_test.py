"""Unit tests for the matchup DTO validators."""

import uuid

import pytest
from pydantic import ValidationError

from src.dto.alliance.dto_matchup import (
    MatchupDefenderGridCell,
    MatchupEvaluationRow,
    MatchupTargetInput,
    MatchupUpsertRequest,
)
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


def test_upsert_rejects_two_node_targets():
    node = {"target_type": MatchupTargetType.NODE, "verdict": MatchupVerdict.OK}
    with pytest.raises(ValidationError):
        MatchupUpsertRequest(
            champion_id=uuid.uuid4(),
            targets=[
                MatchupTargetInput(**node, node_number=1),
                MatchupTargetInput(**node, node_number=2),
            ],
        )


def _champion_ref() -> dict:
    return {
        "champion_id": uuid.uuid4(),
        "champion_name": "Doctor Doom",
        "champion_class": "Mystic",
    }


def test_evaluation_row_rejects_a_score_on_a_discouraged_fight():
    with pytest.raises(ValidationError):
        MatchupEvaluationRow(champion=_champion_ref(), is_discouraged=True, score=4)


def test_evaluation_row_rejects_a_missing_score_when_not_discouraged():
    with pytest.raises(ValidationError):
        MatchupEvaluationRow(champion=_champion_ref(), is_discouraged=False, score=None)


def test_evaluation_row_accepts_discouraged_without_a_score():
    row = MatchupEvaluationRow(champion=_champion_ref(), is_discouraged=True)
    assert row.score is None


def test_evaluation_row_accepts_a_zero_score_when_not_discouraged():
    row = MatchupEvaluationRow(champion=_champion_ref(), is_discouraged=False, score=0)
    assert row.score == 0


def _node_side(node_number: int) -> dict:
    return {"node_number": node_number, "verdict": MatchupVerdict.OK}


def _defender_grid_cell(**overrides) -> dict:
    payload = {
        "attacker_champion_id": uuid.uuid4(),
        "node_number": 7,
        "is_discouraged": False,
        "score": 3,
        "node": _node_side(7),
    }
    payload.update(overrides)
    return payload


def test_defender_grid_cell_rejects_a_node_detail_from_another_node():
    """The coordinate and the detail are two views of one node; a mismatch would open the
    detail of a fight the user never clicked."""
    with pytest.raises(ValidationError):
        MatchupDefenderGridCell(**_defender_grid_cell(node=_node_side(8)))


def test_defender_grid_cell_accepts_a_node_detail_on_the_same_node():
    cell = MatchupDefenderGridCell(**_defender_grid_cell())
    assert cell.node.node_number == cell.node_number

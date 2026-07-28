import uuid

import pytest

from src.dto.account.game.dto_vision_predictions import (
    VisionPredictionResponse,
    VisionPredictionsResponse,
)
from src.models.VisionPredictionCandidate import VisionPredictionCandidate
from src.services.account.game.VisionImportService import VisionImportService


def _candidates(*pairs):
    """Build candidate rows the way the ordered relationship hands them over."""
    return [
        VisionPredictionCandidate(
            prediction_id=uuid.uuid4(), name=name, score=score, position=position
        )
        for position, (name, score) in enumerate(pairs)
    ]


@pytest.mark.parametrize(
    "pairs, expected",
    [
        # The motivating case: a high absolute score the old badge painted green,
        # with the runner-up 0.01 behind. Both real misreads looked like this.
        ((("Gladiator", 0.79), ("Gorr", 0.78)), 0.01),
        ((("Hulk", 0.91), ("Thor", 0.40)), 0.51),
        # Fewer than two candidates: there is no gap to speak of, so None rather
        # than a made-up number the UI would have to guess the meaning of.
        ((("Solo", 0.62),), None),
        ((), None),
        # A dead heat is maximum ambiguity, and 0.0 says exactly that.
        ((("A", 0.5), ("B", 0.5)), 0.0),
    ],
)
def test_margin_from_candidates(pairs, expected):
    result = VisionImportService._margin(_candidates(*pairs))
    if expected is None:
        assert result is None
    else:
        assert result == pytest.approx(expected)


def test_predictions_response_shape():
    pred = VisionPredictionResponse(
        id=uuid.uuid4(),
        job_id=uuid.uuid4(),
        champion_name="Hulk",
        champion_class="Science",
        stars=7,
        rank=3,
        signature=200,
        ascension=1,
        confidence=0.87,
        crop_index=0,
        job_index=0,
    )
    payload = VisionPredictionsResponse(import_id=uuid.uuid4(), predictions=[pred])
    assert payload.predictions[0].champion_name == "Hulk"
    assert payload.predictions[0].crop_index == 0


def test_predictions_response_allows_unknown_champion():
    pred = VisionPredictionResponse(
        id=uuid.uuid4(),
        job_id=uuid.uuid4(),
        champion_name=None,
        champion_class=None,
        stars=7,
        rank=1,
        signature=0,
        ascension=0,
        confidence=0.09,
        crop_index=None,
        job_index=0,
    )
    assert pred.champion_name is None
    assert pred.crop_index is None

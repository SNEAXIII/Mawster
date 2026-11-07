import uuid

import pytest

from src.dto.account.game.dto_vision_predictions import (
    VisionPredictionResponse,
    VisionPredictionsResponse,
    VisionPreview,
)
from src.models.vision.VisionPrediction import VisionPrediction
from src.models.vision.VisionPredictionCandidate import VisionPredictionCandidate
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
    ("pairs", "expected"),
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
        # A reranked card: the pixel second pass put the lower CLIP cosine first,
        # so the margin is negative. It must come back signed, not absolute —
        # collapsing it would erase the difference from a genuine near-tie.
        ((("Spider-Man (Stark Enhanced)", 0.8528), ("Spider-Man (Classic)", 0.8561)), -0.0033),
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
        preview=VisionPreview(left=0.1, right=0.3, top=0.05, bottom=0.4),
        job_index=0,
    )
    payload = VisionPredictionsResponse(import_id=uuid.uuid4(), predictions=[pred])
    assert payload.predictions[0].champion_name == "Hulk"
    assert payload.predictions[0].preview.right == 0.3


def test_preview_from_prediction_keeps_a_card_touching_the_left_edge():
    prediction = VisionPrediction(
        job_id=uuid.uuid4(),
        preview_left=0.0,
        preview_right=0.2,
        preview_top=0.05,
        preview_bottom=0.4,
    )

    preview = VisionPreview.from_prediction(prediction)

    assert preview == VisionPreview(left=0.0, right=0.2, top=0.05, bottom=0.4)


def test_preview_from_prediction_is_none_without_columns():
    assert VisionPreview.from_prediction(VisionPrediction(job_id=uuid.uuid4())) is None


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
        job_index=0,
    )
    assert pred.champion_name is None
    assert pred.preview is None

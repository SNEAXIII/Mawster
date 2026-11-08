import uuid

from src.dto.account.game.dto_vision_predictions import (
    VisionPredictionResponse,
    VisionPredictionsResponse,
    VisionPreview,
)
from src.models.vision.VisionPrediction import VisionPrediction


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

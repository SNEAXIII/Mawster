import uuid

from src.dto.account.game.dto_vision_predictions import (
    VisionPredictionResponse,
    VisionPredictionsResponse,
)


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

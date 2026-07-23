import uuid

import pytest
from pydantic import ValidationError

from src.dto.account.game.dto_vision_result import VisionResultMessage


def _payload(**overrides) -> dict:
    payload = {
        "job_id": str(uuid.uuid4()),
        "import_id": str(uuid.uuid4()),
        "status": "done",
        "error": None,
        "result_key": "imports/a/b/result.json",
        "predictions": [
            {
                "champion_name": "Hulk",
                "champion_class": "Science",
                "stars": 7,
                "rank": 3,
                "signature": 200,
                "ascension": 1,
                "confidence": 0.87,
                "crop_key": "imports/a/b/crops/0.png",
            }
        ],
    }
    payload.update(overrides)
    return payload


def test_result_message_parses_the_worker_contract():
    message = VisionResultMessage.model_validate(_payload())
    assert message.status == "done"
    assert len(message.predictions) == 1
    assert message.predictions[0].champion_name == "Hulk"
    assert message.predictions[0].confidence == 0.87


def test_result_message_accepts_an_unknown_champion():
    message = VisionResultMessage.model_validate(
        _payload(
            predictions=[
                {
                    "champion_name": None,
                    "stars": 7,
                    "rank": 1,
                    "signature": 0,
                    "ascension": 0,
                    "confidence": 0.09,
                }
            ]
        )
    )
    assert message.predictions[0].champion_name is None
    assert message.predictions[0].crop_key is None


def test_result_message_accepts_a_failure_with_no_predictions():
    message = VisionResultMessage.model_validate(
        _payload(status="failed", error="pipeline exploded", result_key=None, predictions=[])
    )
    assert message.status == "failed"
    assert message.error == "pipeline exploded"
    assert message.predictions == []


def test_result_message_rejects_an_unknown_status():
    with pytest.raises(ValidationError):
        VisionResultMessage.model_validate(_payload(status="in_progress"))


def test_prediction_message_parses_candidates():
    from src.dto.account.game.dto_vision_result import VisionPredictionMessage

    message = VisionPredictionMessage.model_validate(
        {
            "champion_name": "Gladiator",
            "confidence": 0.79,
            "candidates": [
                {"name": "Gladiator", "score": 0.79},
                {"name": "Gorr", "score": 0.78},
            ],
        }
    )

    assert len(message.candidates) == 2
    assert message.candidates[1].name == "Gorr"
    assert message.candidates[1].score == 0.78


def test_prediction_message_without_candidates_stays_valid():
    """An older worker sends no candidates at all. It must keep working."""
    from src.dto.account.game.dto_vision_result import VisionPredictionMessage

    message = VisionPredictionMessage.model_validate({"champion_name": "Hulk", "confidence": 0.91})

    assert message.candidates == []

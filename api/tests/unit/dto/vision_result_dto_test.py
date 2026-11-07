import uuid

import pytest
from pydantic import ValidationError

from src.dto.account.game.dto_vision_result import VisionPredictionMessage, VisionResultMessage

PREVIEW = {"left": 0.1, "right": 0.3, "top": 0.05, "bottom": 0.4}


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
                "preview": PREVIEW,
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
    assert message.predictions[0].preview.model_dump() == PREVIEW


def test_prediction_message_from_a_worker_still_sending_crop_key_stays_valid():
    message = VisionPredictionMessage.model_validate(
        {"champion_name": "Hulk", "crop_key": "imports/a/b/crops/sprite_v1.webp#0"}
    )

    assert message.preview is None


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
    assert message.predictions[0].preview is None


def test_result_message_accepts_a_failure_with_no_predictions():
    message = VisionResultMessage.model_validate(
        _payload(status="failed", error="pipeline exploded", result_key=None, predictions=[])
    )
    assert message.status == "failed"
    assert message.error == "pipeline exploded"
    assert message.predictions == []


def test_result_message_rejects_an_unknown_status():
    payload = _payload(status="in_progress")

    with pytest.raises(ValidationError):
        VisionResultMessage.model_validate(payload)


def test_prediction_message_ignores_candidates_from_the_python_worker():
    message = VisionPredictionMessage.model_validate(
        {
            "champion_name": "Gladiator",
            "confidence": 0.79,
            "candidates": [{"name": "Gorr", "score": 0.78}],
        }
    )

    assert message.champion_name == "Gladiator"
    assert message.confidence == 0.79

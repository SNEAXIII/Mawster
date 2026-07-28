import uuid
from datetime import UTC, datetime

from src.dto.account.game.dto_vision_current import CurrentVisionImportResponse


def test_current_import_response_shape():
    payload = CurrentVisionImportResponse(
        id=uuid.uuid4(),
        status="done",
        screens_total=3,
        screens_done=3,
        created_at=datetime.now(UTC),
        predictions_count=16,
    )
    assert payload.predictions_count == 16
    assert payload.status == "done"

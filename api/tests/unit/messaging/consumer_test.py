import json
import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest

from src.messaging.consumer import VisionResultConsumer


def _message(body: bytes) -> MagicMock:
    message = MagicMock()
    message.body = body
    message.reject = AsyncMock()
    process = MagicMock()
    process.__aenter__ = AsyncMock(return_value=None)
    process.__aexit__ = AsyncMock(return_value=None)
    message.process = MagicMock(return_value=process)
    return message


@pytest.mark.asyncio
async def test_valid_message_is_handed_to_the_service(mocker):
    handle = mocker.patch(
        "src.messaging.consumer.VisionResultService.handle", new_callable=AsyncMock
    )
    mocker.patch("src.messaging.consumer.Session", MagicMock())
    consumer = VisionResultConsumer()
    payload = {
        "job_id": str(uuid.uuid4()),
        "import_id": str(uuid.uuid4()),
        "status": "done",
        "predictions": [],
    }

    await consumer._on_message(_message(json.dumps(payload).encode()))

    handle.assert_awaited_once()


@pytest.mark.asyncio
async def test_unparseable_message_is_rejected_without_requeue(mocker):
    """A permanently broken message must go to the DLQ. Requeuing it would spin
    the API at 100% CPU forever."""
    handle = mocker.patch(
        "src.messaging.consumer.VisionResultService.handle", new_callable=AsyncMock
    )
    consumer = VisionResultConsumer()
    message = _message(b"this is not json")

    await consumer._on_message(message)

    handle.assert_not_awaited()
    message.reject.assert_awaited_once_with(requeue=False)


@pytest.mark.asyncio
async def test_message_off_contract_is_rejected_without_requeue(mocker):
    handle = mocker.patch(
        "src.messaging.consumer.VisionResultService.handle", new_callable=AsyncMock
    )
    consumer = VisionResultConsumer()
    message = _message(json.dumps({"job_id": "not-a-uuid"}).encode())

    await consumer._on_message(message)

    handle.assert_not_awaited()
    message.reject.assert_awaited_once_with(requeue=False)


@pytest.mark.asyncio
async def test_start_is_a_no_op_when_disabled(mocker):
    mocker.patch("src.messaging.consumer.SECRET.VISION_CONSUMER_ENABLED", False)
    connect = mocker.patch("src.messaging.consumer.connect_robust", new_callable=AsyncMock)

    await VisionResultConsumer().start()

    connect.assert_not_awaited()

import json
import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest

from src.messaging.consumer import VisionResultConsumer


def _message(body: bytes, redelivered: bool = False) -> MagicMock:
    message = MagicMock()
    message.body = body
    message.redelivered = redelivered
    message.reject = AsyncMock()
    message.nack = AsyncMock()
    message.ack = AsyncMock()
    return message


@pytest.mark.asyncio
async def test_valid_message_is_handed_to_the_service(mocker):
    handle = mocker.patch(
        "src.messaging.consumer.VisionResultService.handle", new_callable=AsyncMock
    )
    mocker.patch("src.messaging.consumer.Session", MagicMock())
    consumer = VisionResultConsumer()
    job_id = str(uuid.uuid4())
    import_id = str(uuid.uuid4())
    payload = {
        "job_id": job_id,
        "import_id": import_id,
        "status": "done",
        "predictions": [],
    }

    message = _message(json.dumps(payload).encode())
    await consumer._on_message(message)

    handle.assert_awaited_once()
    handled_result = handle.await_args.args[1]
    assert str(handled_result.job_id) == job_id
    assert str(handled_result.import_id) == import_id
    message.ack.assert_awaited_once()
    message.nack.assert_not_awaited()
    message.reject.assert_not_awaited()


@pytest.mark.asyncio
async def test_handle_failure_not_yet_redelivered_is_nacked_for_one_retry(mocker):
    """handle() is idempotent, so a single replay is safe insurance against a
    transient failure (DB blip, deadlock)."""
    mocker.patch(
        "src.messaging.consumer.VisionResultService.handle",
        new_callable=AsyncMock,
        side_effect=RuntimeError("boom"),
    )
    mocker.patch("src.messaging.consumer.Session", MagicMock())
    consumer = VisionResultConsumer()
    payload = {
        "job_id": str(uuid.uuid4()),
        "import_id": str(uuid.uuid4()),
        "status": "done",
        "predictions": [],
    }

    message = _message(json.dumps(payload).encode(), redelivered=False)
    await consumer._on_message(message)

    message.nack.assert_awaited_once_with(requeue=True)
    message.reject.assert_not_awaited()
    message.ack.assert_not_awaited()


@pytest.mark.asyncio
async def test_handle_failure_already_redelivered_is_rejected_without_requeue(mocker):
    """The replay also failed: this looks deterministic, not transient. Give up
    rather than hot-loop, since this queue has no DLQ to catch the drop."""
    mocker.patch(
        "src.messaging.consumer.VisionResultService.handle",
        new_callable=AsyncMock,
        side_effect=RuntimeError("boom"),
    )
    mocker.patch("src.messaging.consumer.Session", MagicMock())
    consumer = VisionResultConsumer()
    payload = {
        "job_id": str(uuid.uuid4()),
        "import_id": str(uuid.uuid4()),
        "status": "done",
        "predictions": [],
    }

    message = _message(json.dumps(payload).encode(), redelivered=True)
    await consumer._on_message(message)

    message.reject.assert_awaited_once_with(requeue=False)
    message.nack.assert_not_awaited()
    message.ack.assert_not_awaited()


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

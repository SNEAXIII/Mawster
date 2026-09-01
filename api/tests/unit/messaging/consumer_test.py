import itertools
import json
import logging
import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest

from src.messaging import consumer as consumer_module
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


class _StopLoopError(Exception):
    """Breaks _run()'s infinite retry loop from the sleep it is throttled by."""


def _refuse_connection(mocker, error: Exception) -> None:
    mocker.patch(
        "src.messaging.consumer.connect_robust",
        new_callable=AsyncMock,
        side_effect=error,
    )


@pytest.mark.asyncio
async def test_unreachable_broker_is_logged_without_a_traceback(mocker, caplog):
    """A refused connection is the normal state while RabbitMQ is down. Dumping a
    stack every RECONNECT_DELAY_SECONDS buries the logs for no added information."""
    _refuse_connection(mocker, ConnectionRefusedError(111, "Connection refused"))
    sleep = mocker.patch(
        "src.messaging.consumer.asyncio.sleep",
        new_callable=AsyncMock,
        side_effect=_StopLoopError,
    )
    consumer = VisionResultConsumer()

    with (
        caplog.at_level(logging.DEBUG, logger="src.messaging.consumer"),
        pytest.raises(_StopLoopError),
    ):
        await consumer._run()

    assert len(caplog.records) == 1
    record = caplog.records[0]
    assert record.levelno == logging.WARNING
    assert record.exc_info is None
    assert "cannot reach RabbitMQ" in record.getMessage()
    sleep.assert_awaited_once_with(consumer_module.RECONNECT_DELAY_SECONDS)


@pytest.mark.asyncio
async def test_repeated_refusals_warn_once_per_throttle_window(mocker, caplog):
    _refuse_connection(mocker, ConnectionRefusedError(111, "Connection refused"))
    attempts = itertools.count(1)

    async def _sleep(_delay):
        if next(attempts) >= consumer_module.RECONNECT_LOG_EVERY_N_ATTEMPTS:
            raise _StopLoopError

    mocker.patch("src.messaging.consumer.asyncio.sleep", _sleep)
    consumer = VisionResultConsumer()

    with (
        caplog.at_level(logging.DEBUG, logger="src.messaging.consumer"),
        pytest.raises(_StopLoopError),
    ):
        await consumer._run()

    warnings = [r for r in caplog.records if r.levelno == logging.WARNING]
    assert [r.args[-1] for r in warnings] == [
        1,
        consumer_module.RECONNECT_LOG_EVERY_N_ATTEMPTS,
    ]
    assert all(r.levelno == logging.DEBUG for r in caplog.records if r not in warnings)


@pytest.mark.asyncio
async def test_unexpected_start_failure_keeps_its_traceback(mocker, caplog):
    """Only broker-unreachable is routine. Anything else needs the stack."""
    _refuse_connection(mocker, RuntimeError("topology mismatch"))
    mocker.patch(
        "src.messaging.consumer.asyncio.sleep",
        new_callable=AsyncMock,
        side_effect=_StopLoopError,
    )
    consumer = VisionResultConsumer()

    with (
        caplog.at_level(logging.DEBUG, logger="src.messaging.consumer"),
        pytest.raises(_StopLoopError),
    ):
        await consumer._run()

    assert len(caplog.records) == 1
    record = caplog.records[0]
    assert record.levelno == logging.ERROR
    assert record.exc_info is not None


@pytest.mark.asyncio
async def test_failure_after_connecting_closes_the_half_open_connection(mocker):
    connection = MagicMock()
    connection.channel = AsyncMock(side_effect=ConnectionResetError("reset"))
    connection.close = AsyncMock()
    mocker.patch(
        "src.messaging.consumer.connect_robust",
        new_callable=AsyncMock,
        return_value=connection,
    )
    mocker.patch(
        "src.messaging.consumer.asyncio.sleep",
        new_callable=AsyncMock,
        side_effect=_StopLoopError,
    )
    consumer = VisionResultConsumer()

    with pytest.raises(_StopLoopError):
        await consumer._run()

    connection.close.assert_awaited_once()
    assert consumer._connection is None

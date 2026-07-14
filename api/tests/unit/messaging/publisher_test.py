import asyncio
import json
import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest

from src.messaging.publisher import VisionPublisher
from src.messaging.topology import EXCHANGE_NAME, ROUTING_KEY_JOB


@pytest.mark.asyncio
async def test_publish_job_sends_expected_payload(mocker):
    exchange = AsyncMock()
    channel = AsyncMock()
    channel.declare_exchange = AsyncMock(return_value=exchange)
    channel.declare_queue = AsyncMock(return_value=MagicMock(bind=AsyncMock()))
    connection = AsyncMock()
    connection.channel = AsyncMock(return_value=channel)
    mocker.patch("src.messaging.publisher.connect_robust", AsyncMock(return_value=connection))

    publisher = VisionPublisher()
    job_id = uuid.uuid4()
    import_id = uuid.uuid4()

    await publisher.publish_job(
        job_id=job_id,
        import_id=import_id,
        bucket="vision",
        object_key=f"imports/{import_id}/{job_id}/screen.png",
    )

    exchange.publish.assert_awaited_once()
    message, kwargs = exchange.publish.await_args
    assert kwargs["routing_key"] == ROUTING_KEY_JOB
    payload = json.loads(message[0].body)
    assert payload == {
        "job_id": str(job_id),
        "import_id": str(import_id),
        "bucket": "vision",
        "object_key": f"imports/{import_id}/{job_id}/screen.png",
    }


@pytest.mark.asyncio
async def test_exchange_name_is_stable():
    assert EXCHANGE_NAME == "mcoc.vision"


@pytest.mark.asyncio
async def test_ensure_exchange_concurrent_calls_connect_only_once(mocker):
    """Two publish_job calls racing before the first connection is established
    must not both open a connection - the second one would leak the first
    connection's channel."""
    exchange = AsyncMock()
    channel = AsyncMock()
    channel.declare_exchange = AsyncMock(return_value=exchange)
    channel.declare_queue = AsyncMock(return_value=MagicMock(bind=AsyncMock()))
    connection = AsyncMock()
    connection.is_closed = False
    connection.channel = AsyncMock(return_value=channel)

    connect_calls = 0

    async def fake_connect_robust(_url):
        nonlocal connect_calls
        connect_calls += 1
        # Yield control so the second concurrent caller has a chance to race in
        # before this call resolves - this is what reproduces the bug.
        await asyncio.sleep(0.01)
        return connection

    mocker.patch(
        "src.messaging.publisher.connect_robust",
        AsyncMock(side_effect=fake_connect_robust),
    )

    publisher = VisionPublisher()

    results = await asyncio.gather(
        publisher._ensure_exchange(),
        publisher._ensure_exchange(),
    )

    assert connect_calls == 1
    assert results[0] is exchange
    assert results[1] is exchange


@pytest.mark.asyncio
async def test_ensure_exchange_reconnects_when_connection_is_closed(mocker):
    """A previously-established but now-closed connection must not be reused
    forever - _ensure_exchange should rebuild it."""
    exchange = AsyncMock()
    channel = AsyncMock()
    channel.declare_exchange = AsyncMock(return_value=exchange)
    channel.declare_queue = AsyncMock(return_value=MagicMock(bind=AsyncMock()))

    live_connection = AsyncMock()
    live_connection.is_closed = False
    live_connection.channel = AsyncMock(return_value=channel)

    mocker.patch(
        "src.messaging.publisher.connect_robust",
        AsyncMock(return_value=live_connection),
    )

    publisher = VisionPublisher()
    dead_connection = AsyncMock()
    dead_connection.is_closed = True
    publisher._connection = dead_connection
    publisher._exchange = AsyncMock()  # stale exchange belonging to the dead connection

    result = await publisher._ensure_exchange()

    assert result is exchange
    assert publisher._connection is live_connection

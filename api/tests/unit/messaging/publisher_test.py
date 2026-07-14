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

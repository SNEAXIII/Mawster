import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest
from aio_pika.exceptions import DeliveryError

from src.messaging.publisher import VisionPublisher


@pytest.mark.asyncio
async def test_publish_uses_mandatory_flag(mocker):
    """A job routed to no queue must not vanish. mandatory=True makes the broker
    return an unroutable message instead of dropping it."""
    exchange = AsyncMock()
    publisher = VisionPublisher()
    mocker.patch.object(publisher, "_ensure_exchange", AsyncMock(return_value=exchange))

    await publisher.publish_job(
        job_id=uuid.uuid4(), import_id=uuid.uuid4(), bucket="vision", object_key="k"
    )

    _, kwargs = exchange.publish.call_args
    assert kwargs.get("mandatory") is True


@pytest.mark.asyncio
async def test_unroutable_publish_raises(mocker):
    """An unroutable message surfaces as an error the caller can compensate on,
    not a silent drop."""
    exchange = AsyncMock()
    exchange.publish.side_effect = DeliveryError(MagicMock(), None)
    publisher = VisionPublisher()
    mocker.patch.object(publisher, "_ensure_exchange", AsyncMock(return_value=exchange))

    with pytest.raises(DeliveryError):
        await publisher.publish_job(
            job_id=uuid.uuid4(), import_id=uuid.uuid4(), bucket="vision", object_key="k"
        )

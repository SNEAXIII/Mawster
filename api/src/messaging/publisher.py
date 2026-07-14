import json
import uuid

from aio_pika import DeliveryMode, Message, connect_robust
from aio_pika.abc import AbstractExchange, AbstractRobustConnection

from src.messaging.topology import ROUTING_KEY_JOB, declare_topology
from src.security.secrets import SECRET


class VisionPublisher:
    """Publishes vision jobs onto the broker.

    The connection is lazy and reused: opening one per HTTP request would add a
    TCP+AMQP handshake to every upload.
    """

    def __init__(self) -> None:
        self._connection: AbstractRobustConnection | None = None
        self._exchange: AbstractExchange | None = None

    async def _ensure_exchange(self) -> AbstractExchange:
        if self._exchange is not None and self._connection is not None:
            return self._exchange
        self._connection = await connect_robust(SECRET.RABBITMQ_URL)
        channel = await self._connection.channel()
        self._exchange = await declare_topology(channel)
        return self._exchange

    async def publish_job(
        self,
        job_id: uuid.UUID,
        import_id: uuid.UUID,
        bucket: str,
        object_key: str,
    ) -> None:
        exchange = await self._ensure_exchange()
        payload = {
            "job_id": str(job_id),
            "import_id": str(import_id),
            "bucket": bucket,
            "object_key": object_key,
        }
        message = Message(
            body=json.dumps(payload).encode(),
            content_type="application/json",
            delivery_mode=DeliveryMode.PERSISTENT,
            message_id=str(job_id),
        )
        await exchange.publish(message, routing_key=ROUTING_KEY_JOB)

    async def close(self) -> None:
        if self._connection is not None:
            await self._connection.close()
            self._connection = None
            self._exchange = None

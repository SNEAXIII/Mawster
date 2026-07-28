import asyncio
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
        self._connect_lock = asyncio.Lock()

    def _is_connected(self) -> bool:
        return (
            self._connection is not None
            and not self._connection.is_closed
            and self._exchange is not None
        )

    async def _ensure_exchange(self) -> AbstractExchange:
        # Fast path: no lock needed once a live connection/exchange exists.
        if self._is_connected():
            return self._exchange
        async with self._connect_lock:
            # Re-check inside the lock: another task may have connected while
            # we were waiting (or the connection we saw as dead may have been
            # replaced already).
            if self._is_connected():
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
        # mandatory=True: if the message routes to no queue (topology gap, a
        # deleted queue), the broker RETURNS it and aio-pika raises DeliveryError
        # instead of silently dropping it. The caller (create_import / retry_job)
        # already compensates a failed publish by marking the job JOB_NEVER_QUEUED.
        await exchange.publish(message, routing_key=ROUTING_KEY_JOB, mandatory=True)

    async def close(self) -> None:
        if self._connection is not None:
            await self._connection.close()
            self._connection = None
            self._exchange = None

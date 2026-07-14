import asyncio
import json
import logging

from aio_pika import connect_robust
from aio_pika.abc import AbstractIncomingMessage, AbstractRobustConnection
from pydantic import ValidationError
from sqlalchemy.orm import sessionmaker
from sqlmodel.ext.asyncio.session import AsyncSession

from src.dto.account.game.dto_vision_result import VisionResultMessage
from src.messaging.topology import QUEUE_RESULTS, declare_topology
from src.security.secrets import SECRET
from src.services.account.game.VisionResultService import VisionResultService
from src.utils.db import async_engine

logger = logging.getLogger(__name__)

Session = sessionmaker(bind=async_engine, class_=AsyncSession, expire_on_commit=False)

RECONNECT_DELAY_SECONDS = 5


class VisionResultConsumer:
    """Consumes `vision.results` inside the FastAPI process.

    This is the price of routing results back through the broker rather than an
    HTTP callback: the API has to run an AMQP consumer in-process. Keep it thin —
    all the business logic lives in VisionResultService, which is why that logic
    stays testable without a broker.
    """

    def __init__(self) -> None:
        self._connection: AbstractRobustConnection | None = None
        self._task: asyncio.Task | None = None

    async def start(self) -> None:
        if not SECRET.VISION_CONSUMER_ENABLED:
            logger.info("vision consumer disabled (VISION_CONSUMER_ENABLED=false)")
            return
        self._task = asyncio.create_task(self._run())

    async def _run(self) -> None:
        while True:
            try:
                self._connection = await connect_robust(SECRET.RABBITMQ_URL)
                channel = await self._connection.channel()
                await channel.set_qos(prefetch_count=1)
                await declare_topology(channel)
                queue = await channel.get_queue(QUEUE_RESULTS)
                await queue.consume(self._on_message)
                logger.info("vision consumer listening on %s", QUEUE_RESULTS)
                return
            except Exception:  # noqa: BLE001
                logger.exception(
                    "vision consumer could not connect, retrying in %ss",
                    RECONNECT_DELAY_SECONDS,
                )
                await asyncio.sleep(RECONNECT_DELAY_SECONDS)

    async def _on_message(self, message: AbstractIncomingMessage) -> None:
        try:
            payload = json.loads(message.body)
            result = VisionResultMessage.model_validate(payload)
        except (json.JSONDecodeError, ValidationError):
            # Permanently broken: no amount of retrying will parse it. Send it to
            # the DLQ. Requeuing would spin this consumer forever.
            logger.exception("undecodable vision result, sending to the dead-letter queue")
            await message.reject(requeue=False)
            return

        async with message.process():
            async with Session() as session:
                await VisionResultService.handle(session, result)

    async def stop(self) -> None:
        if self._task is not None:
            self._task.cancel()
            self._task = None
        if self._connection is not None:
            await self._connection.close()
            self._connection = None

"""Model-free fake vision worker, for E2E only.

Structurally identical to mcoc-vision's real worker on the messaging side —
same exchange/queue/routing keys, the same passive `get_queue` topology-wait,
the same `prefetch=1`, the same explicit ack/nack/reject paths — but it never
loads a model. Instead of running the pipeline, it reads the screenshot from
RustFS (aioboto3, like the real worker), uploads a fixture `result.json`, and
publishes deterministic predictions on `vision.results`.

This exists to exercise the wiring (front -> API -> RabbitMQ -> worker -> API
-> preview) in E2E without shipping the real worker's ~3.5 GB of torch/paddle
models. It must NEVER run at the same time as the real `vision-worker` — both
consume the same `vision.jobs` queue, so running both makes message delivery
non-deterministic. That is why it lives under the `e2e` compose profile.

The AMQP contract and the `vision.results` payload shape are owned by
Mawster's API (source of truth: api/src/messaging/topology.py and
api/src/dto/account/game/dto_vision_result.py). They are copied here, not
imported, because this is a separate image/process.
"""

import asyncio
import json
import logging
import os

import aioboto3
from aio_pika import DeliveryMode, ExchangeType, Message, connect_robust
from aio_pika.abc import AbstractIncomingMessage
from aiormq.exceptions import ChannelNotFoundEntity

logger = logging.getLogger(__name__)

# --- AMQP contract, copied from api/src/messaging/topology.py --------------
# The API owns the topology: it declares `vision.jobs` with dead-letter
# arguments. This worker must NOT declare it — a mismatched declare raises
# PRECONDITION_FAILED and closes the channel for every connected process.
EXCHANGE_NAME = "mcoc.vision"
QUEUE_JOBS = "vision.jobs"
ROUTING_KEY_RESULT = "result"

# On a cold stack this worker can start before the API has declared the
# topology. Retry the passive declare instead of crash-looping.
QUEUE_WAIT_SECONDS = 5

# --- Config, env names match the real worker's api.env on purpose ----------
RABBITMQ_URL = os.environ.get("RABBITMQ_URL", "amqp://mawster:mawster@localhost:5672/")
RUSTFS_ENDPOINT = os.environ.get("RUSTFS_ENDPOINT", "http://localhost:9000")
RUSTFS_ACCESS_KEY = os.environ.get("RUSTFS_ACCESS_KEY", "mawster")
RUSTFS_SECRET_KEY = os.environ.get("RUSTFS_SECRET_KEY", "mawsterpassword")

# --- Deterministic fixture. T14's E2E asserts on these exact values --------
# crop_key stays None: no thumbnails are uploaded. T14's spec must match this.
PREDICTIONS = [
    {
        "champion_name": "Hulk",
        "champion_class": "Science",
        "stars": 7,
        "rank": 3,
        "signature": 200,
        "ascension": 1,
        "confidence": 0.91,
        "crop_key": None,
    },
    {
        "champion_name": "Iron Man",
        "champion_class": "Tech",
        "stars": 6,
        "rank": 5,
        "signature": 0,
        "ascension": 0,
        "confidence": 0.42,
        "crop_key": None,
    },
]


class FakeStorage:
    """S3-compatible object access (RustFS). Mirrors the real worker's WorkerStorage:
    a client is opened per call because aioboto3 binds its session to the running
    event loop, and a long-lived one breaks across reconnects."""

    def __init__(self) -> None:
        self._session = aioboto3.Session()

    def _client(self):
        return self._session.client(
            "s3",
            endpoint_url=RUSTFS_ENDPOINT,
            aws_access_key_id=RUSTFS_ACCESS_KEY,
            aws_secret_access_key=RUSTFS_SECRET_KEY,
        )

    async def get_bytes(self, bucket: str, key: str) -> bytes:
        async with self._client() as client:
            response = await client.get_object(Bucket=bucket, Key=key)
            return await response["Body"].read()

    async def put_bytes(self, bucket: str, key: str, data: bytes, content_type: str) -> None:
        async with self._client() as client:
            await client.put_object(Bucket=bucket, Key=key, Body=data, ContentType=content_type)


class FakeVisionWorker:
    def __init__(self) -> None:
        self.storage = FakeStorage()
        self.exchange = None

    async def run(self) -> None:
        connection = await connect_robust(RABBITMQ_URL)

        waiting = False
        while True:
            channel = await connection.channel()
            # One job at a time, like the real worker — keeps behaviour
            # identical even though there is no model to bottleneck on here.
            await channel.set_qos(prefetch_count=1)
            self.exchange = await channel.declare_exchange(
                EXCHANGE_NAME, ExchangeType.DIRECT, durable=True
            )
            try:
                # Passive declare: only succeeds once the API has declared the
                # queue. Must not be declared here (see QUEUE_WAIT_SECONDS above).
                queue = await channel.get_queue(QUEUE_JOBS)
            except ChannelNotFoundEntity:
                # RabbitMQ closes the channel on a failed passive declare, so
                # the retry needs a fresh channel, not this one.
                if not waiting:
                    logger.info(
                        "queue %s does not exist yet, waiting for the API to declare "
                        "the AMQP topology (normal on a cold stack, retrying every %ss)",
                        QUEUE_JOBS,
                        QUEUE_WAIT_SECONDS,
                    )
                    waiting = True
                await asyncio.sleep(QUEUE_WAIT_SECONDS)
                continue
            break

        if waiting:
            logger.info("queue %s is now declared", QUEUE_JOBS)
        logger.info("fake vision worker listening on %s", QUEUE_JOBS)
        await queue.consume(self._on_message)
        await asyncio.Future()  # run forever

    async def _on_message(self, message: AbstractIncomingMessage) -> None:
        try:
            job = json.loads(message.body)
            job_id = job["job_id"]
            import_id = job["import_id"]
            bucket = job["bucket"]
            object_key = job["object_key"]
        except (json.JSONDecodeError, KeyError):
            # Off-contract message: nothing will ever parse it. `vision.jobs`
            # has a dead-letter exchange (declared by the API) — this routes
            # there instead of spinning the consumer at 100% CPU forever.
            logger.exception("undecodable job message, rejecting without requeue")
            await message.reject(requeue=False)
            return

        try:
            result = await self._process(job_id, import_id, bucket, object_key)
        except Exception as error:  # noqa: BLE001
            # Mirrors the real worker: report a "failed" result and let the
            # API own the retry, rather than requeue a deterministic failure.
            logger.exception("fake vision job %s failed", job_id)
            result = {
                "job_id": job_id,
                "import_id": import_id,
                "status": "failed",
                "error": f"{type(error).__name__}: {error}"[:500],
                "result_key": None,
                "predictions": [],
            }

        try:
            await self._publish(result)
        except Exception:  # noqa: BLE001
            # A publish failure is transient (broker blip), unlike a pipeline
            # failure — requeue so a fresh delivery gets another shot.
            logger.exception(
                "failed to publish fake vision result for job %s (import %s), requeuing",
                job_id,
                import_id,
            )
            await message.nack(requeue=True)
            return

        await message.ack()

    async def _process(self, job_id: str, import_id: str, bucket: str, object_key: str) -> dict:
        # Read the screenshot like the real worker does, to exercise the same
        # RustFS read path end to end. The bytes themselves are never inspected.
        await self.storage.get_bytes(bucket, object_key)

        result_key = f"imports/{import_id}/{job_id}/result.json"
        await self.storage.put_bytes(
            bucket,
            result_key,
            json.dumps({"cards": PREDICTIONS}).encode(),
            "application/json",
        )

        return {
            "job_id": job_id,
            "import_id": import_id,
            "status": "done",
            "error": None,
            "result_key": result_key,
            "predictions": PREDICTIONS,
        }

    async def _publish(self, result: dict) -> None:
        await self.exchange.publish(
            Message(
                body=json.dumps(result).encode(),
                content_type="application/json",
                delivery_mode=DeliveryMode.PERSISTENT,
                message_id=result["job_id"],
            ),
            routing_key=ROUTING_KEY_RESULT,
        )


async def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    )
    await FakeVisionWorker().run()


if __name__ == "__main__":
    asyncio.run(main())

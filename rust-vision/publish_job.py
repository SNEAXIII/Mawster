"""Upload a real screenshot to RustFS and publish its vision job on the dev broker.

    uv run publish_job.py data/real/shot_01.png [copies]

The worker runs the whole job, but the API drops its result: no such job in its database.
"""

import asyncio
import json
import mimetypes
import sys
import uuid
from pathlib import Path

from aio_pika import DeliveryMode, Message, connect_robust
from worker import settings
from worker.storage import WorkerStorage


async def main(image: Path, copies: int) -> None:
    data = image.read_bytes()
    content_type = mimetypes.guess_type(image.name)[0] or "application/octet-stream"
    storage = WorkerStorage()
    async with await connect_robust(settings.RABBITMQ_URL) as connection:
        channel = await connection.channel()
        exchange = await channel.get_exchange("mcoc.vision")
        job_id, import_id = uuid.uuid4(), uuid.uuid4()
        payload = {
            "job_id": str(job_id),
            "import_id": str(import_id),
            "bucket": settings.BUCKET_VISION,
            "object_key": f"imports/{import_id}/{job_id}/screen.png",
        }
        await storage.put_bytes(
            payload["bucket"], payload["object_key"], data, content_type
        )
        for _ in range(copies):
            await exchange.publish(
                Message(
                    body=json.dumps(payload).encode(),
                    content_type="application/json",
                    delivery_mode=DeliveryMode.PERSISTENT,
                    message_id=str(job_id),
                ),
                routing_key="job",
                mandatory=True,
            )
            print(json.dumps(payload, indent=2))


asyncio.run(main(Path(sys.argv[1]), int(sys.argv[2]) if len(sys.argv) > 2 else 1))

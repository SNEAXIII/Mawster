"""Upload a real screenshot to RustFS and publish its vision job on the dev broker.

    uv run scripts/publish_job.py artifacts-vision/data/real/shot_0001.png [copies]

The worker runs the whole job, but the API drops its result: no such job in its database.
"""

import asyncio
import json
import mimetypes
import os
import sys
import uuid
from pathlib import Path

import aioboto3
from aio_pika import DeliveryMode, Message, connect_robust

RABBITMQ_URL = os.environ.get("RABBITMQ_URL", "amqp://mawster:mawster@localhost:5672/")
RUSTFS_ENDPOINT = os.environ.get("RUSTFS_ENDPOINT", "http://localhost:9000")
RUSTFS_ACCESS_KEY = os.environ.get("RUSTFS_ACCESS_KEY", "mawster")
RUSTFS_SECRET_KEY = os.environ.get("RUSTFS_SECRET_KEY", "mawsterpassword")
BUCKET_VISION = os.environ.get("RUSTFS_BUCKET_VISION", "vision")


async def main(image: Path, copies: int) -> None:
    data = image.read_bytes()
    content_type = mimetypes.guess_type(image.name)[0] or "application/octet-stream"
    async with await connect_robust(RABBITMQ_URL) as connection:
        channel = await connection.channel()
        exchange = await channel.get_exchange("mcoc.vision")
        job_id, import_id = uuid.uuid4(), uuid.uuid4()
        payload = {
            "job_id": str(job_id),
            "import_id": str(import_id),
            "bucket": BUCKET_VISION,
            "object_key": f"imports/{import_id}/{job_id}/screen.png",
        }
        async with aioboto3.Session().client(
            "s3",
            endpoint_url=RUSTFS_ENDPOINT,
            aws_access_key_id=RUSTFS_ACCESS_KEY,
            aws_secret_access_key=RUSTFS_SECRET_KEY,
        ) as s3:
            await s3.put_object(
                Bucket=payload["bucket"],
                Key=payload["object_key"],
                Body=data,
                ContentType=content_type,
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

import uuid
from typing import Protocol


def screen_key(import_id: uuid.UUID, job_id: uuid.UUID) -> str:
    """Object key of the raw uploaded screenshot."""
    return f"imports/{import_id}/{job_id}/screen.png"


def result_key(import_id: uuid.UUID, job_id: uuid.UUID) -> str:
    """Object key of the pipeline JSON output."""
    return f"imports/{import_id}/{job_id}/result.json"


def crop_key(import_id: uuid.UUID, job_id: uuid.UUID, index: int) -> str:
    """Object key of a single champion crop, used by the review screen."""
    return f"imports/{import_id}/{job_id}/crops/{index}.png"


def sprite_key(import_id: uuid.UUID, job_id: uuid.UUID) -> str:
    """Object key of the sheet holding every thumbnail of one screenshot.

    Cross-repo contract with the vision worker (mcoc-vision/worker/crops.py):
    do not change this layout on one side only. Versioned so that changing the
    cell geometry ships as a new key instead of a stale cached image.
    """
    return f"imports/{import_id}/{job_id}/crops/sprite_v1.webp"


def import_prefix(import_id: uuid.UUID) -> str:
    """Prefix covering every object of an import, across all its jobs.

    Cross-repo contract with the vision worker: do not change this layout.
    """
    return f"imports/{import_id}/"


class Storage(Protocol):
    """Object storage seam. The S3 implementation is the only one in prod, but
    tests swap in a fake so they never need a running RustFS."""

    async def put_bytes(self, bucket: str, key: str, data: bytes, content_type: str) -> None: ...

    async def get_bytes(self, bucket: str, key: str) -> bytes: ...

    async def delete_prefix(self, bucket: str, prefix: str) -> None: ...

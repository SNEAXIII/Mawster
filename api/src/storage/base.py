import uuid
from dataclasses import dataclass
from typing import Protocol


def screen_key(import_id: uuid.UUID, job_id: uuid.UUID) -> str:
    """Object key of the raw uploaded screenshot."""
    return f"imports/{import_id}/{job_id}/screen.png"


def result_key(import_id: uuid.UUID, job_id: uuid.UUID) -> str:
    """Object key of the pipeline JSON output."""
    return f"imports/{import_id}/{job_id}/result.json"


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


@dataclass(frozen=True)
class ObjectStat:
    """What a HEAD tells us about an object the browser uploaded on its own.

    Only the two fields the commit step can act on. Both come from the client:
    `size` is what RustFS actually stored (trustworthy), `content_type` is what
    the uploader declared (a claim, checked against the file's magic bytes).
    """

    size: int
    content_type: str | None


class Storage(Protocol):
    """Object storage seam. The S3 implementation is the only one in prod, but
    tests swap in a fake so they never need a running RustFS."""

    async def put_bytes(self, bucket: str, key: str, data: bytes, content_type: str) -> None: ...

    async def get_bytes(self, bucket: str, key: str) -> bytes: ...

    async def delete_prefix(self, bucket: str, prefix: str) -> None: ...

    async def presigned_put_url(
        self, bucket: str, key: str, content_type: str, expires_in: int
    ) -> str:
        """A URL the browser can PUT one object to, without any credential.

        Signed against the *public* endpoint, not the internal one: SigV4 covers
        the Host header, so a URL signed for `http://rustfs:9000` is rejected the
        moment a browser sends it to `https://s3.mawster.app`.
        """
        ...

    async def stat_object(self, bucket: str, key: str) -> ObjectStat | None:
        """Size and declared type of one object, or None if it does not exist."""
        ...

    async def get_head_bytes(self, bucket: str, key: str, length: int) -> bytes:
        """The first `length` bytes of an object.

        Ranged on purpose: the commit step sniffs magic bytes on up to 40
        screenshots, and doing that with `get_bytes` would pull 320 MB through
        the API to read 12 bytes per file — exactly the traffic presigned upload
        exists to avoid.
        """
        ...

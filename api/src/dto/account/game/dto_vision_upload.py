"""Schemas of the two-phase, direct-to-storage import.

Phase 1 (`init`) hands the browser one presigned URL per screenshot; phase 2
(`commit`) verifies what actually landed in the bucket and queues the work. The
bytes never pass through the API — which is the whole point — so everything the
server would have learned by reading the upload has to be re-established from
the stored object instead. That asymmetry is why the declaration below is
treated as a claim, never as fact.
"""

import uuid

from pydantic import BaseModel, Field


class VisionScreenDeclaration(BaseModel):
    """What the client says it is about to upload.

    Used to reject a batch before signing anything: 40 doomed URLs cost a
    round-trip and a row each. None of it is trusted at `commit` — the stored
    object is measured and sniffed there.
    """

    filename: str = Field(max_length=255)
    content_type: str
    # Declared byte count. Lets an oversized file fail at init instead of after
    # the user has waited through its upload.
    size: int = Field(ge=0)


class VisionInitRequest(BaseModel):
    game_account_id: uuid.UUID
    screens: list[VisionScreenDeclaration]
    share_dataset: bool = False


class VisionUploadTarget(BaseModel):
    """One screenshot's destination. `url` is credential-free and short-lived."""

    job_id: uuid.UUID
    filename: str
    url: str
    # Must be echoed as the PUT's Content-Type header: it is part of the
    # signature, so any other value fails with SignatureDoesNotMatch.
    content_type: str


class VisionInitResponse(BaseModel):
    import_id: uuid.UUID
    # Seconds the URLs stay valid. The front shows nothing with it, but a client
    # that batches uploads needs to know when to stop retrying and re-init.
    expires_in: int
    uploads: list[VisionUploadTarget]

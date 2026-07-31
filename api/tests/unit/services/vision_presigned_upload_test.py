"""Unit tests for the direct-to-storage import: `init_import` / `commit_import`.

The theme running through the commit tests: the API never sees the upload, so
every property it used to learn by reading the request body has to be re-derived
from the stored object. Each one that is not re-checked is a way to put arbitrary
bytes in front of the vision worker.
"""

import uuid

import pytest
from fastapi import HTTPException

from src.dto.account.game.dto_vision_upload import VisionScreenDeclaration
from src.models.VisionImport import VisionImport, VisionImportStatus
from src.models.VisionJob import VisionJob, VisionJobStatus
from src.services.account.game.VisionImportService import (
    MAX_SCREEN_BYTES,
    MAX_SCREENS_PER_IMPORT,
    VisionImportService,
)
from src.storage.base import ObjectStat

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 4
JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 8


class FakeStorage:
    """In-memory object store that answers the three calls commit relies on.

    `objects` maps key -> (bytes, content_type). A key that is absent models a
    screenshot the browser never uploaded, which is the default state of every
    job between init and commit.
    """

    def __init__(self, objects: dict[str, tuple[bytes, str]] | None = None):
        self.objects = objects or {}
        self.signed: list[tuple[str, str]] = []
        self.deleted_prefixes: list[str] = []

    async def presigned_put_url(
        self, bucket: str, key: str, content_type: str, expires_in: int
    ) -> str:
        self.signed.append((key, content_type))
        return f"https://s3.test/{bucket}/{key}?sig=stub&exp={expires_in}"

    async def stat_object(self, bucket: str, key: str) -> ObjectStat | None:
        if key not in self.objects:
            return None
        data, content_type = self.objects[key]
        return ObjectStat(size=len(data), content_type=content_type)

    async def get_head_bytes(self, bucket: str, key: str, length: int) -> bytes:
        return self.objects[key][0][:length]

    async def delete_prefix(self, bucket: str, prefix: str) -> None:
        self.deleted_prefixes.append(prefix)


class FakeResult:
    def __init__(self, rows):
        self._rows = rows

    def all(self):
        return self._rows


class FakeSession:
    """Async session stub: records adds, and returns pre-seeded rows from exec."""

    def __init__(self, jobs: list[VisionJob] | None = None):
        self.added: list[object] = []
        self.commits = 0
        self._jobs = jobs or []

    def add(self, obj) -> None:
        self.added.append(obj)

    async def commit(self) -> None:
        self.commits += 1

    async def refresh(self, _obj) -> None:
        pass

    async def exec(self, _statement):
        return FakeResult(self._jobs)


class FakePublisher:
    def __init__(self):
        self.published: list[uuid.UUID] = []

    async def publish_job(self, job_id, import_id, bucket, object_key) -> None:
        self.published.append(job_id)


def _declaration(name: str = "roster.png", content_type: str = "image/png", size: int = 1024):
    return VisionScreenDeclaration(filename=name, content_type=content_type, size=size)


async def _init(session, storage, screens):
    return await VisionImportService.init_import(
        session=session,
        storage=storage,
        game_account_id=uuid.uuid4(),
        screens=screens,
        share_dataset=False,
    )


# ─── init ────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_init_reserves_rows_and_signs_one_url_per_screen():
    session, storage = FakeSession(), FakeStorage()

    response = await _init(session, storage, [_declaration("a.png"), _declaration("b.png")])

    assert len(response.uploads) == 2
    assert [u.filename for u in response.uploads] == ["a.png", "b.png"]
    assert len(storage.signed) == 2
    # Keys are derived server-side, never taken from the client's filename.
    assert all(key.startswith(f"imports/{response.import_id}/") for key, _ in storage.signed)


@pytest.mark.asyncio
async def test_init_leaves_everything_awaiting_upload():
    """Nothing is runnable yet: the objects the keys name do not exist."""
    session, storage = FakeSession(), FakeStorage()

    await _init(session, storage, [_declaration()])

    vision_import = next(o for o in session.added if isinstance(o, VisionImport))
    job = next(o for o in session.added if isinstance(o, VisionJob))
    assert vision_import.status == VisionImportStatus.AWAITING_UPLOAD
    assert job.status == VisionJobStatus.AWAITING_UPLOAD


@pytest.mark.asyncio
async def test_init_rejects_more_screens_than_the_batch_limit():
    session, storage = FakeSession(), FakeStorage()
    screens = [_declaration() for _ in range(MAX_SCREENS_PER_IMPORT + 1)]

    with pytest.raises(HTTPException) as exc:
        await _init(session, storage, screens)

    assert exc.value.status_code == 400
    assert storage.signed == []


@pytest.mark.asyncio
async def test_init_rejects_an_unsupported_declared_type():
    session, storage = FakeSession(), FakeStorage()

    with pytest.raises(HTTPException) as exc:
        await _init(session, storage, [_declaration(content_type="application/pdf")])

    assert exc.value.status_code == 400
    assert storage.signed == []


@pytest.mark.asyncio
async def test_init_rejects_a_declared_size_over_the_cap():
    """Fail before signing, so the user is not told at commit that file 2 of 40
    was too big — after uploading all forty."""
    session, storage = FakeSession(), FakeStorage()

    with pytest.raises(HTTPException) as exc:
        await _init(session, storage, [_declaration(size=MAX_SCREEN_BYTES + 1)])

    assert exc.value.status_code == 400
    assert storage.signed == []


# ─── commit ──────────────────────────────────────────────────────────────


def _awaiting_import() -> VisionImport:
    return VisionImport(
        game_account_id=uuid.uuid4(),
        screens_total=1,
        status=VisionImportStatus.AWAITING_UPLOAD,
    )


def _awaiting_job(vision_import: VisionImport, filename: str = "roster.png") -> VisionJob:
    job = VisionJob(
        import_id=vision_import.id,
        object_key="",
        filename=filename,
        status=VisionJobStatus.AWAITING_UPLOAD,
    )
    job.object_key = f"imports/{vision_import.id}/{job.id}/screen.png"
    return job


@pytest.mark.asyncio
async def test_commit_queues_the_batch_when_every_object_checks_out():
    vision_import = _awaiting_import()
    job = _awaiting_job(vision_import)
    storage = FakeStorage({job.object_key: (PNG, "image/png")})
    session, publisher = FakeSession([job]), FakePublisher()

    result = await VisionImportService.commit_import(session, storage, publisher, vision_import)

    assert result.status == VisionImportStatus.PENDING
    assert job.status == VisionJobStatus.PENDING
    assert publisher.published == [job.id]


@pytest.mark.asyncio
async def test_commit_refuses_a_screenshot_that_was_never_uploaded():
    vision_import = _awaiting_import()
    job = _awaiting_job(vision_import, "missing.png")
    session, publisher = FakeSession([job]), FakePublisher()

    with pytest.raises(HTTPException) as exc:
        await VisionImportService.commit_import(
            session, storage := FakeStorage(), publisher, vision_import
        )

    assert exc.value.status_code == 400
    assert "missing.png" in exc.value.detail
    assert publisher.published == []
    assert storage.objects == {}


@pytest.mark.asyncio
async def test_commit_refuses_an_object_larger_than_the_cap():
    """The size declared at init is a claim. A presigned PUT cannot enforce it,
    so an honest-looking init followed by a 20 MB upload has to die here."""
    vision_import = _awaiting_import()
    job = _awaiting_job(vision_import)
    oversized = PNG + b"\x00" * MAX_SCREEN_BYTES
    storage = FakeStorage({job.object_key: (oversized, "image/png")})
    session, publisher = FakeSession([job]), FakePublisher()

    with pytest.raises(HTTPException) as exc:
        await VisionImportService.commit_import(session, storage, publisher, vision_import)

    assert exc.value.status_code == 400
    assert publisher.published == []


@pytest.mark.asyncio
async def test_commit_refuses_bytes_that_are_not_an_image():
    """Content-Type is signed, so it is whatever the client asked us to sign —
    it says nothing about the file behind it."""
    vision_import = _awaiting_import()
    job = _awaiting_job(vision_import)
    storage = FakeStorage({job.object_key: (b"#!/bin/sh\nrm -rf /", "image/png")})
    session, publisher = FakeSession([job]), FakePublisher()

    with pytest.raises(HTTPException) as exc:
        await VisionImportService.commit_import(session, storage, publisher, vision_import)

    assert exc.value.status_code == 400
    assert publisher.published == []


@pytest.mark.asyncio
async def test_commit_refuses_a_type_that_contradicts_the_magic_bytes():
    vision_import = _awaiting_import()
    job = _awaiting_job(vision_import)
    storage = FakeStorage({job.object_key: (JPEG, "image/png")})
    session, publisher = FakeSession([job]), FakePublisher()

    with pytest.raises(HTTPException) as exc:
        await VisionImportService.commit_import(session, storage, publisher, vision_import)

    assert exc.value.status_code == 400
    assert publisher.published == []


@pytest.mark.asyncio
async def test_commit_rejects_the_whole_batch_when_one_screenshot_is_bad():
    """A partially queued import would hand the user a roster with silent holes
    in it — worse than a refusal, because nothing says which rows are missing."""
    vision_import = _awaiting_import()
    good, bad = _awaiting_job(vision_import, "ok.png"), _awaiting_job(vision_import, "bad.png")
    storage = FakeStorage({good.object_key: (PNG, "image/png")})
    session, publisher = FakeSession([good, bad]), FakePublisher()

    with pytest.raises(HTTPException):
        await VisionImportService.commit_import(session, storage, publisher, vision_import)

    assert publisher.published == []
    assert good.status == VisionJobStatus.AWAITING_UPLOAD


@pytest.mark.asyncio
async def test_commit_is_a_no_op_once_the_import_left_awaiting_upload():
    """A double-click or a retried request must not queue the batch twice."""
    vision_import = _awaiting_import()
    vision_import.status = VisionImportStatus.PENDING
    job = _awaiting_job(vision_import)
    storage = FakeStorage({job.object_key: (PNG, "image/png")})
    session, publisher = FakeSession([job]), FakePublisher()

    result = await VisionImportService.commit_import(session, storage, publisher, vision_import)

    assert result is vision_import
    assert publisher.published == []

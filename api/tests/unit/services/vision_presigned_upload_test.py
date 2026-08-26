"""Unit tests for the direct-to-storage import: `init` / `commit_screen` / `commit`.

The theme running through the commit tests: the API never sees the upload, so
every property it used to learn by reading the request body has to be re-derived
from the stored object. Each one that is not re-checked is a way to put arbitrary
bytes in front of the vision worker.

`commit_screen` is where that verification now happens for the common case, one
screenshot at a time as it lands; `commit_import` is the seal that settles
whatever never made it. The second theme is therefore duplication: neither may
ever queue a screenshot the other already queued.
"""

import uuid

import pytest
from fastapi import HTTPException

from src.dto.account.game.dto_vision_upload import VisionScreenDeclaration
from src.models.vision.VisionImport import VisionImport, VisionImportStatus
from src.models.vision.VisionJob import VisionJob, VisionJobStatus
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

    async def get(self, _model, primary_key):
        return next((job for job in self._jobs if job.id == primary_key), None)


class FakePublisher:
    def __init__(self, fails: bool = False):
        self.published: list[uuid.UUID] = []
        self.fails = fails

    async def publish_job(self, job_id, import_id, bucket, object_key) -> None:
        if self.fails:
            raise ConnectionError("broker down")
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

    declaration = _declaration(content_type="application/pdf")

    with pytest.raises(HTTPException) as exc:
        await _init(session, storage, [declaration])

    assert exc.value.status_code == 400
    assert storage.signed == []


@pytest.mark.asyncio
async def test_init_rejects_a_declared_size_over_the_cap():
    """Fail before signing, so the user is not told at commit that file 2 of 40
    was too big — after uploading all forty."""
    session, storage = FakeSession(), FakeStorage()

    declaration = _declaration(size=MAX_SCREEN_BYTES + 1)

    with pytest.raises(HTTPException) as exc:
        await _init(session, storage, [declaration])

    assert exc.value.status_code == 400
    assert storage.signed == []


# ─── commit ──────────────────────────────────────────────────────────────


def _awaiting_import(screens_total: int = 1) -> VisionImport:
    return VisionImport(
        game_account_id=uuid.uuid4(),
        screens_total=screens_total,
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


async def _commit_screen(session, storage, publisher, vision_import, job):
    return await VisionImportService.commit_screen(
        session, storage, publisher, vision_import, job.id
    )


@pytest.mark.asyncio
async def test_commit_screen_queues_that_screenshot_alone():
    """The point of the whole design: screenshot 1 reaches the worker while
    screenshot 2 is still uploading."""
    vision_import = _awaiting_import(screens_total=2)
    first, second = _awaiting_job(vision_import, "a.png"), _awaiting_job(vision_import, "b.png")
    storage = FakeStorage({first.object_key: (PNG, "image/png")})
    session, publisher = FakeSession([first, second]), FakePublisher()

    await _commit_screen(session, storage, publisher, vision_import, first)

    assert publisher.published == [first.id]
    assert first.status == VisionJobStatus.PENDING
    assert second.status == VisionJobStatus.AWAITING_UPLOAD


@pytest.mark.asyncio
async def test_commit_screen_takes_the_import_out_of_awaiting_upload():
    """Something is queued now, so the import is no longer merely reserved."""
    vision_import = _awaiting_import()
    job = _awaiting_job(vision_import)
    storage = FakeStorage({job.object_key: (PNG, "image/png")})

    await _commit_screen(FakeSession([job]), storage, FakePublisher(), vision_import, job)

    assert vision_import.status == VisionImportStatus.PENDING


@pytest.mark.asyncio
async def test_commit_screen_is_a_no_op_for_an_already_queued_job():
    """A double-click, a retried request, or the seal sweeping a job this call
    already published — none of them may queue the same screenshot twice."""
    vision_import = _awaiting_import()
    job = _awaiting_job(vision_import)
    job.status = VisionJobStatus.PENDING
    storage = FakeStorage({job.object_key: (PNG, "image/png")})
    session, publisher = FakeSession([job]), FakePublisher()

    result = await _commit_screen(session, storage, publisher, vision_import, job)

    assert result is job
    assert publisher.published == []


@pytest.mark.asyncio
async def test_commit_screen_refuses_a_job_from_another_import():
    """The import is authorised by the controller; the job is not. Without this
    check, its id alone would queue a stranger's screenshot."""
    vision_import = _awaiting_import()
    foreign = _awaiting_job(_awaiting_import(), "stranger.png")
    storage = FakeStorage({foreign.object_key: (PNG, "image/png")})
    session, publisher = FakeSession([foreign]), FakePublisher()

    with pytest.raises(HTTPException) as exc:
        await _commit_screen(session, storage, publisher, vision_import, foreign)

    assert exc.value.status_code == 404
    assert publisher.published == []


@pytest.mark.asyncio
async def test_commit_screen_leaves_a_missing_object_retryable():
    """Not failed: the presigned URL is good for fifteen minutes, so the browser
    can still retry the PUT. Only the seal decides a screenshot is lost."""
    vision_import = _awaiting_import()
    job = _awaiting_job(vision_import, "missing.png")
    session, publisher = FakeSession([job]), FakePublisher()

    storage = FakeStorage()

    with pytest.raises(HTTPException) as exc:
        await _commit_screen(session, storage, publisher, vision_import, job)

    assert exc.value.status_code == 400
    assert "missing.png" in exc.value.detail
    assert job.status == VisionJobStatus.AWAITING_UPLOAD
    assert publisher.published == []


@pytest.mark.asyncio
async def test_commit_screen_refuses_an_object_larger_than_the_cap():
    """The size declared at init is a claim. A presigned PUT cannot enforce it,
    so an honest-looking init followed by a 20 MB upload has to die here."""
    vision_import = _awaiting_import()
    job = _awaiting_job(vision_import)
    oversized = PNG + b"\x00" * MAX_SCREEN_BYTES
    storage = FakeStorage({job.object_key: (oversized, "image/png")})
    session, publisher = FakeSession([job]), FakePublisher()

    with pytest.raises(HTTPException) as exc:
        await _commit_screen(session, storage, publisher, vision_import, job)

    assert exc.value.status_code == 400
    assert publisher.published == []


@pytest.mark.asyncio
async def test_commit_screen_refuses_bytes_that_are_not_an_image():
    """Content-Type is signed, so it is whatever the client asked us to sign —
    it says nothing about the file behind it."""
    vision_import = _awaiting_import()
    job = _awaiting_job(vision_import)
    storage = FakeStorage({job.object_key: (b"#!/bin/sh\nrm -rf /", "image/png")})
    session, publisher = FakeSession([job]), FakePublisher()

    with pytest.raises(HTTPException) as exc:
        await _commit_screen(session, storage, publisher, vision_import, job)

    assert exc.value.status_code == 400
    assert publisher.published == []


@pytest.mark.asyncio
async def test_commit_screen_refuses_a_type_that_contradicts_the_magic_bytes():
    vision_import = _awaiting_import()
    job = _awaiting_job(vision_import)
    storage = FakeStorage({job.object_key: (JPEG, "image/png")})
    session, publisher = FakeSession([job]), FakePublisher()

    with pytest.raises(HTTPException) as exc:
        await _commit_screen(session, storage, publisher, vision_import, job)

    assert exc.value.status_code == 400
    assert publisher.published == []


@pytest.mark.asyncio
async def test_commit_screen_counts_a_job_the_broker_refused():
    """A job that is never published produces no worker result, and a worker
    result is the only other thing that moves `screens_done`. Miss this and the
    import stops one screenshot short of its total forever."""
    vision_import = _awaiting_import()
    job = _awaiting_job(vision_import)
    storage = FakeStorage({job.object_key: (PNG, "image/png")})
    session = FakeSession([job])

    publisher = FakePublisher(fails=True)

    with pytest.raises(HTTPException) as exc:
        await _commit_screen(session, storage, publisher, vision_import, job)

    assert exc.value.status_code == 503
    assert job.status == VisionJobStatus.FAILED
    assert vision_import.screens_done == 1
    assert vision_import.status == VisionImportStatus.DONE


# ─── commit (seal) ───────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_commit_queues_a_screenshot_whose_per_screen_call_never_arrived():
    """The bytes are in the bucket but no one queued them — a lost request, or a
    tab that closed between the PUT and the commit."""
    vision_import = _awaiting_import()
    job = _awaiting_job(vision_import)
    storage = FakeStorage({job.object_key: (PNG, "image/png")})
    session, publisher = FakeSession([job]), FakePublisher()

    result = await VisionImportService.commit_import(session, storage, publisher, vision_import)

    assert result.status == VisionImportStatus.PENDING
    assert job.status == VisionJobStatus.PENDING
    assert publisher.published == [job.id]


@pytest.mark.asyncio
async def test_commit_never_republishes_an_already_queued_job():
    """The common case: every screenshot was queued as it landed, so the seal has
    nothing to do. Doing it again would run the whole roster through the worker
    twice."""
    vision_import = _awaiting_import()
    job = _awaiting_job(vision_import)
    job.status = VisionJobStatus.RUNNING
    storage = FakeStorage({job.object_key: (PNG, "image/png")})
    session, publisher = FakeSession([job]), FakePublisher()

    await VisionImportService.commit_import(session, storage, publisher, vision_import)

    assert publisher.published == []
    assert job.status == VisionJobStatus.RUNNING


@pytest.mark.asyncio
async def test_commit_fails_only_the_screenshot_that_never_uploaded():
    """The batch cannot be rejected any more: the screenshots that did upload are
    already running in the worker and cannot be recalled. The user gets the rows
    that could be read, plus one failed screenshot to relaunch."""
    vision_import = _awaiting_import(screens_total=2)
    good, lost = _awaiting_job(vision_import, "ok.png"), _awaiting_job(vision_import, "lost.png")
    storage = FakeStorage({good.object_key: (PNG, "image/png")})
    session, publisher = FakeSession([good, lost]), FakePublisher()

    await VisionImportService.commit_import(session, storage, publisher, vision_import)

    assert publisher.published == [good.id]
    assert good.status == VisionJobStatus.PENDING
    assert lost.status == VisionJobStatus.FAILED
    assert "lost.png" in lost.error
    # One of the two screenshots will never come back, and the import has to
    # account for it now or it never reaches its total.
    assert vision_import.screens_done == 1
    assert vision_import.status == VisionImportStatus.RUNNING


@pytest.mark.asyncio
async def test_commit_finishes_an_import_where_nothing_uploaded():
    """Every screenshot lost means the import is over on the spot — a spinner
    with nothing behind it is the one outcome that has no way out."""
    vision_import = _awaiting_import()
    job = _awaiting_job(vision_import, "lost.png")
    session, publisher = FakeSession([job]), FakePublisher()

    result = await VisionImportService.commit_import(
        session, FakeStorage(), publisher, vision_import
    )

    assert result.status == VisionImportStatus.DONE
    assert job.status == VisionJobStatus.FAILED
    assert publisher.published == []


@pytest.mark.asyncio
async def test_commit_is_a_no_op_on_a_finished_import():
    """Confirmed and cancelled are terminal: a late seal must not resurrect
    them, nor queue screenshots for an import the user already walked away from."""
    for terminal in (VisionImportStatus.CONFIRMED, VisionImportStatus.CANCELLED):
        vision_import = _awaiting_import()
        vision_import.status = terminal
        job = _awaiting_job(vision_import)
        storage = FakeStorage({job.object_key: (PNG, "image/png")})
        session, publisher = FakeSession([job]), FakePublisher()

        result = await VisionImportService.commit_import(session, storage, publisher, vision_import)

        assert result.status == terminal
        assert publisher.published == []

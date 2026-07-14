import io
import uuid
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException
from starlette.datastructures import Headers, UploadFile

from src.models.VisionImport import VisionImportStatus
from src.models.VisionJob import VisionJobStatus
from src.services.account.game.VisionImportService import (
    MAX_SCREEN_BYTES,
    MAX_SCREENS_PER_IMPORT,
    VisionImportService,
)
from src.storage.base import import_prefix


class FakeStorage:
    """In-memory Storage. Keeps the service tests free of RustFS."""

    def __init__(self):
        self.puts: list[tuple[str, str, bytes]] = []
        self.deleted_prefixes: list[str] = []
        self.calls: list[str] = []

    async def put_bytes(self, bucket: str, key: str, data: bytes, content_type: str) -> None:
        self.calls.append("put_bytes")
        self.puts.append((bucket, key, data))

    async def get_bytes(self, bucket: str, key: str) -> bytes:  # pragma: no cover
        raise NotImplementedError

    async def presign_get(self, bucket: str, key: str, expires_in: int) -> str:  # pragma: no cover
        raise NotImplementedError

    async def delete_prefix(self, bucket: str, prefix: str) -> None:
        self.calls.append("delete_prefix")
        self.deleted_prefixes.append(prefix)
        self.puts = [(b, k, d) for (b, k, d) in self.puts if not k.startswith(prefix)]


class FakeSession:
    """Records commit() calls (and their ordering relative to other mocks) without
    needing a real DB. add()/refresh() are no-ops: the objects are already
    populated by the service before being added."""

    def __init__(self, calls: list[str]):
        self._calls = calls
        self.added = []

    def add(self, obj) -> None:
        self.added.append(obj)

    async def commit(self) -> None:
        self._calls.append("commit")

    async def refresh(self, obj) -> None:
        pass


class FakePublisher:
    """Publishes successfully up to `fail_at` (0-indexed), then raises."""

    def __init__(self, calls: list[str], fail_at: int | None = None):
        self._calls = calls
        self.fail_at = fail_at
        self.published: list[uuid.UUID] = []

    async def publish_job(self, job_id, import_id, bucket, object_key) -> None:
        self._calls.append("publish")
        if self.fail_at is not None and len(self.published) == self.fail_at:
            raise ConnectionError("broker unreachable")
        self.published.append(job_id)


def _upload(
    name: str = "shot.png",
    content_type: str = "image/png",
    content: bytes = b"png-bytes",
) -> UploadFile:
    """Build an UploadFile the way Starlette does — content_type is read from the headers."""
    return UploadFile(
        file=io.BytesIO(content),
        filename=name,
        headers=Headers({"content-type": content_type}),
    )


@pytest.mark.asyncio
async def test_create_import_rejects_empty_file_list():
    with pytest.raises(HTTPException) as exc:
        await VisionImportService.create_import(
            session=AsyncMock(),
            storage=FakeStorage(),
            publisher=AsyncMock(),
            game_account_id=uuid.uuid4(),
            files=[],
            share_dataset=False,
        )
    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_create_import_rejects_too_many_files():
    files = [_upload(f"s{i}.png") for i in range(MAX_SCREENS_PER_IMPORT + 1)]
    with pytest.raises(HTTPException) as exc:
        await VisionImportService.create_import(
            session=AsyncMock(),
            storage=FakeStorage(),
            publisher=AsyncMock(),
            game_account_id=uuid.uuid4(),
            files=files,
            share_dataset=False,
        )
    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_create_import_rejects_oversized_screen():
    oversized = _upload("big.png", content=b"0" * (MAX_SCREEN_BYTES + 1))
    with pytest.raises(HTTPException) as exc:
        await VisionImportService.create_import(
            session=AsyncMock(),
            storage=FakeStorage(),
            publisher=AsyncMock(),
            game_account_id=uuid.uuid4(),
            files=[oversized],
            share_dataset=False,
        )
    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_create_import_rejects_unsupported_content_type():
    pdf = _upload("roster.pdf", content_type="application/pdf", content=b"%PDF")
    with pytest.raises(HTTPException) as exc:
        await VisionImportService.create_import(
            session=AsyncMock(),
            storage=FakeStorage(),
            publisher=AsyncMock(),
            game_account_id=uuid.uuid4(),
            files=[pdf],
            share_dataset=False,
        )
    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_create_import_rejects_unsupported_content_type_before_touching_storage():
    """A bad file anywhere in the batch must cost zero bytes read and zero
    objects written — content type is validated up front, before any file is
    opened."""
    files = [_upload("ok.png"), _upload("roster.pdf", content_type="application/pdf")]
    storage = FakeStorage()
    with pytest.raises(HTTPException):
        await VisionImportService.create_import(
            session=AsyncMock(),
            storage=storage,
            publisher=AsyncMock(),
            game_account_id=uuid.uuid4(),
            files=files,
            share_dataset=False,
        )
    assert storage.puts == []


@pytest.mark.asyncio
async def test_create_import_happy_path_stores_and_publishes_one_job_per_screenshot():
    calls: list[str] = []
    storage = FakeStorage()
    publisher = FakePublisher(calls)
    session = FakeSession(calls)

    files = [_upload("s1.png"), _upload("s2.png"), _upload("s3.png")]
    vision_import = await VisionImportService.create_import(
        session=session,
        storage=storage,
        publisher=publisher,
        game_account_id=uuid.uuid4(),
        files=files,
        share_dataset=False,
    )

    assert len(storage.puts) == 3
    assert len(publisher.published) == 3
    stored_keys = {key for (_bucket, key, _data) in storage.puts}
    persisted_keys = {job.object_key for job in session.added if hasattr(job, "object_key")}
    assert stored_keys == persisted_keys
    assert vision_import.status != VisionImportStatus.FAILED


@pytest.mark.asyncio
async def test_create_import_commits_before_publishing():
    """The invariant this service exists to guarantee: rows are committed before
    anything is published, so a worker can never see a job_id the DB doesn't
    have yet. A reordered implementation (publish, then commit) must fail this."""
    calls: list[str] = []
    storage = FakeStorage()
    publisher = FakePublisher(calls)
    session = FakeSession(calls)

    await VisionImportService.create_import(
        session=session,
        storage=storage,
        publisher=publisher,
        game_account_id=uuid.uuid4(),
        files=[_upload("s1.png"), _upload("s2.png")],
        share_dataset=False,
    )

    assert "commit" in calls
    assert "publish" in calls
    assert calls.index("commit") < calls.index("publish")


@pytest.mark.asyncio
async def test_create_import_marks_unpublished_jobs_failed_on_publish_error():
    calls: list[str] = []
    storage = FakeStorage()
    publisher = FakePublisher(calls, fail_at=1)  # publishes job 0, fails on job 1
    session = FakeSession(calls)

    files = [_upload("s1.png"), _upload("s2.png"), _upload("s3.png")]
    with pytest.raises(HTTPException) as exc:
        await VisionImportService.create_import(
            session=session,
            storage=storage,
            publisher=publisher,
            game_account_id=uuid.uuid4(),
            files=files,
            share_dataset=False,
        )
    assert exc.value.status_code == 503

    from src.models.VisionImport import VisionImport
    from src.models.VisionJob import VisionJob

    imports = [obj for obj in session.added if isinstance(obj, VisionImport)]
    # session.add() may record the same object more than once (store loop, then
    # the failure handler); dedupe by identity/id since it's still one row.
    jobs_by_id = {obj.id: obj for obj in session.added if isinstance(obj, VisionJob)}
    assert imports[-1].status == VisionImportStatus.FAILED

    # Exactly one job was published (job 0); the other two must be FAILED with
    # an error explaining they were never queued. The published one keeps its
    # original status.
    unpublished = [job for job in jobs_by_id.values() if job.id not in publisher.published]
    assert len(unpublished) == 2
    for job in unpublished:
        assert job.status == VisionJobStatus.FAILED
        assert job.error


@pytest.mark.asyncio
async def test_create_import_deletes_written_objects_on_later_validation_failure():
    """A validation failure partway through the batch must not leak the objects
    already written to storage for earlier screenshots in the same import."""
    storage = FakeStorage()
    files = [
        _upload("s1.png"),
        _upload("s2.png"),
        _upload("big.png", content=b"0" * (MAX_SCREEN_BYTES + 1)),
    ]

    with pytest.raises(HTTPException):
        await VisionImportService.create_import(
            session=FakeSession([]),
            storage=storage,
            publisher=AsyncMock(),
            game_account_id=uuid.uuid4(),
            files=files,
            share_dataset=False,
        )

    assert storage.puts == []
    assert storage.deleted_prefixes


@pytest.mark.asyncio
async def test_import_prefix_matches_screen_key_layout():
    import_id = uuid.uuid4()
    assert import_prefix(import_id) == f"imports/{import_id}/"

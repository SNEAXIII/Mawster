import io
import uuid
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException
from starlette.datastructures import Headers, UploadFile

from src.models.VisionImport import VisionImport, VisionImportStatus
from src.models.VisionJob import VisionJob, VisionJobStatus
from src.models.VisionPrediction import VisionPrediction
from src.services.account.game.VisionImportService import (
    MAX_SCREEN_BYTES,
    MAX_SCREENS_PER_IMPORT,
    VisionImportService,
)
from src.storage.base import import_prefix


class FakeStorage:
    """In-memory Storage. Keeps the service tests free of RustFS.

    `shared_calls`, when given, is the same list passed to FakeSession /
    FakePublisher so cross-collaborator ordering (e.g. commit vs.
    delete_prefix) can be asserted on a single timeline."""

    def __init__(self, fail_delete: bool = False, shared_calls: list[str] | None = None):
        self.puts: list[tuple[str, str, bytes]] = []
        self.deleted_prefixes: list[str] = []
        self.calls: list[str] = []
        self.fail_delete = fail_delete
        self._shared_calls = shared_calls

    def _record(self, call: str) -> None:
        self.calls.append(call)
        if self._shared_calls is not None:
            self._shared_calls.append(call)

    async def put_bytes(self, bucket: str, key: str, data: bytes, content_type: str) -> None:
        self._record("put_bytes")
        self.puts.append((bucket, key, data))

    async def get_bytes(self, bucket: str, key: str) -> bytes:  # pragma: no cover
        raise NotImplementedError

    async def presign_get(self, bucket: str, key: str, expires_in: int) -> str:  # pragma: no cover
        raise NotImplementedError

    async def delete_prefix(self, bucket: str, prefix: str) -> None:
        self._record("delete_prefix")
        if self.fail_delete:
            raise ConnectionError("RustFS unreachable")
        self.deleted_prefixes.append(prefix)
        self.puts = [(b, k, d) for (b, k, d) in self.puts if not k.startswith(prefix)]


class FakeSession:
    """Records commit()/delete() calls (and their ordering relative to other
    mocks) without needing a real DB. add()/refresh() are no-ops: the objects
    are already populated by the service before being added."""

    def __init__(self, calls: list[str]):
        self._calls = calls
        self.added = []
        self.deleted = []

    def add(self, obj) -> None:
        self.added.append(obj)

    async def commit(self) -> None:
        self._calls.append("commit")

    async def refresh(self, obj) -> None:
        pass

    async def delete(self, obj) -> None:
        # Recorded by type name so ordering assertions can distinguish
        # predictions from jobs from the import itself.
        self._calls.append(f"delete:{type(obj).__name__}")
        self.deleted.append(obj)


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


def _build_import_with_jobs_and_predictions() -> VisionImport:
    """Two jobs, each with one prediction, wired up the way get_import's
    selectinload would leave them (vision_import.jobs / job.predictions
    populated in memory)."""
    vision_import = VisionImport(game_account_id=uuid.uuid4(), screens_total=2)
    jobs = []
    for _ in range(2):
        job = VisionJob(import_id=vision_import.id, object_key="imports/x/y")
        prediction = VisionPrediction(job_id=job.id, champion_name="Doctor Doom")
        job.predictions = [prediction]
        jobs.append(job)
    vision_import.jobs = jobs
    return vision_import


@pytest.mark.asyncio
async def test_delete_import_deletes_predictions_before_jobs_before_import():
    """Load-bearing order: vision_prediction.job_id has no ON DELETE CASCADE,
    so deleting a job that still has predictions would raise IntegrityError in
    a real DB. A reordered implementation must fail this test."""
    calls: list[str] = []
    session = FakeSession(calls)
    storage = FakeStorage()
    vision_import = _build_import_with_jobs_and_predictions()

    await VisionImportService.delete_import(
        session=session, storage=storage, vision_import=vision_import
    )

    delete_calls = [c for c in calls if c.startswith("delete:")]
    last_prediction_index = max(
        i for i, c in enumerate(delete_calls) if c == "delete:VisionPrediction"
    )
    first_job_index = min(i for i, c in enumerate(delete_calls) if c == "delete:VisionJob")
    import_index = next(i for i, c in enumerate(delete_calls) if c == "delete:VisionImport")

    assert last_prediction_index < first_job_index
    assert first_job_index < import_index


@pytest.mark.asyncio
async def test_delete_import_deletes_storage_prefix_after_commit():
    calls: list[str] = []
    session = FakeSession(calls)
    storage = FakeStorage(shared_calls=calls)
    vision_import = _build_import_with_jobs_and_predictions()

    await VisionImportService.delete_import(
        session=session, storage=storage, vision_import=vision_import
    )

    assert "commit" in calls
    assert "delete_prefix" in calls
    assert calls.index("commit") < calls.index("delete_prefix")
    assert storage.deleted_prefixes == [import_prefix(vision_import.id)]


@pytest.mark.asyncio
async def test_delete_import_survives_storage_failure():
    """If RustFS is unreachable after the DB rows are already committed gone,
    the delete must still be reported as successful: the objects are orphaned
    but the `vision` bucket's retention policy reaps them after 7 days, and
    raising here would report a failure for a deletion that already
    committed."""
    session = FakeSession([])
    storage = FakeStorage(fail_delete=True)
    vision_import = _build_import_with_jobs_and_predictions()

    await VisionImportService.delete_import(
        session=session, storage=storage, vision_import=vision_import
    )

    assert "delete_prefix" in storage.calls
    assert storage.deleted_prefixes == []

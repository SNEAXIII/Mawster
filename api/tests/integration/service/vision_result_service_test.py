import uuid

import pytest
from fastapi import HTTPException
from sqlmodel import select

from src.dto.account.game.dto_vision_result import VisionPredictionMessage, VisionResultMessage
from src.enums.VisionImportStatus import VisionImportStatus
from src.enums.VisionJobStatus import VisionJobStatus
from src.Messages.vision_messages import JOB_NEVER_QUEUED
from src.models.vision.VisionImport import VisionImport
from src.models.vision.VisionJob import VisionJob
from src.models.vision.VisionPrediction import VisionPrediction
from src.models.vision.VisionPredictionCandidate import VisionPredictionCandidate
from src.services.account.game.VisionResultService import VisionResultService


async def _make_job(session) -> VisionJob:
    vision_import = VisionImport(game_account_id=uuid.uuid4(), screens_total=1)
    session.add(vision_import)
    await session.commit()
    job = VisionJob(import_id=vision_import.id, object_key="imports/a/b/screen.png")
    session.add(job)
    await session.commit()
    return job


async def _persist_import(session, *, total, statuses) -> tuple[VisionImport, list[VisionJob]]:
    """An import and its jobs, in the database.

    `screens_done` is derived from the jobs by a SQL count, so a FakeSession
    cannot prove anything about progress: these tests need real rows.
    """
    vision_import = VisionImport(game_account_id=uuid.uuid4(), screens_total=total)
    session.add(vision_import)
    await session.commit()

    jobs = []
    for job_status in statuses:
        job = VisionJob(
            import_id=vision_import.id, object_key="imports/a/b/screen.png", status=job_status
        )
        session.add(job)
        jobs.append(job)
    await session.commit()
    return vision_import, jobs


class FakePublisher:
    def __init__(self):
        self.published: list[uuid.UUID] = []

    async def publish_job(self, job_id, import_id, bucket, object_key) -> None:
        self.published.append(job_id)


class RaisingPublisher:
    """Simulates a broker blip: every publish attempt fails."""

    async def publish_job(self, job_id, import_id, bucket, object_key) -> None:
        msg = "broker unavailable"
        raise RuntimeError(msg)


class FakeSession:
    """Records what the service persists, without a database."""

    def __init__(self, job=None, vision_import=None):
        self._job = job
        self._import = vision_import
        self.added: list = []
        self.commits = 0

    async def get(self, model, pk):
        if model is VisionJob:
            return self._job
        if model is VisionImport:
            return self._import
        return None

    def add(self, obj):
        self.added.append(obj)

    async def commit(self):
        self.commits += 1


def _job(status=VisionJobStatus.PENDING, attempts=0) -> VisionJob:
    job = VisionJob(import_id=uuid.uuid4(), object_key="imports/a/b/screen.png")
    job.status = status
    job.attempts = attempts
    return job


def _import(total=2, done=0) -> VisionImport:
    return VisionImport(game_account_id=uuid.uuid4(), screens_total=total, screens_done=done)


def _done_message(job: VisionJob, vision_import: VisionImport) -> VisionResultMessage:
    return VisionResultMessage(
        job_id=job.id,
        import_id=vision_import.id,
        status="done",
        result_key="imports/a/b/result.json",
        predictions=[
            VisionPredictionMessage(
                champion_name="Hulk",
                champion_class="Science",
                stars=7,
                rank=3,
                signature=200,
                ascension=1,
                confidence=0.9,
                crop_key="imports/a/b/crops/0.png",
            )
        ],
    )


@pytest.mark.asyncio
async def test_done_writes_predictions_and_advances_progress(session):
    vision_import, jobs = await _persist_import(
        session, total=2, statuses=(VisionJobStatus.PENDING, VisionJobStatus.PENDING)
    )

    await VisionResultService.handle(session, _done_message(jobs[0], vision_import))

    assert jobs[0].status == VisionJobStatus.DONE
    assert vision_import.screens_done == 1
    assert vision_import.status == VisionImportStatus.RUNNING
    predictions = (await session.exec(select(VisionPrediction))).all()
    assert len(predictions) == 1
    assert predictions[0].champion_name == "Hulk"
    assert predictions[0].signature == 200


@pytest.mark.asyncio
async def test_last_job_flips_the_import_to_done(session):
    vision_import, jobs = await _persist_import(
        session, total=1, statuses=(VisionJobStatus.PENDING,)
    )

    await VisionResultService.handle(session, _done_message(jobs[0], vision_import))

    assert vision_import.screens_done == 1
    assert vision_import.status == VisionImportStatus.DONE


@pytest.mark.asyncio
async def test_redelivery_of_an_already_done_job_is_ignored():
    """AMQP is at-least-once. Without this guard a redelivery duplicates every
    prediction of the screenshot."""
    job, vision_import = _job(status=VisionJobStatus.DONE), _import(total=2, done=1)
    session = FakeSession(job, vision_import)

    await VisionResultService.handle(session, _done_message(job, vision_import))

    assert session.added == []
    assert vision_import.screens_done == 1


@pytest.mark.asyncio
async def test_redelivery_of_an_already_failed_job_is_ignored():
    """AMQP is at-least-once. Without this guard a redelivery of a terminal FAILED
    job would double-count screens_done and increment attempts again."""
    job, vision_import = _job(status=VisionJobStatus.FAILED, attempts=1), _import(total=2, done=1)
    session = FakeSession(job, vision_import)
    message = VisionResultMessage(
        job_id=job.id, import_id=vision_import.id, status="failed", error="ocr blew up"
    )

    await VisionResultService.handle(session, message)

    assert session.added == []
    assert vision_import.screens_done == 1
    assert job.attempts == 1


@pytest.mark.asyncio
async def test_result_for_a_deleted_job_is_ignored():
    """The user can delete the import while the worker is still chewing on it."""
    vision_import = _import()
    session = FakeSession(job=None, vision_import=vision_import)
    message = VisionResultMessage(
        job_id=uuid.uuid4(), import_id=vision_import.id, status="done", predictions=[]
    )

    await VisionResultService.handle(session, message)

    assert session.added == []


@pytest.mark.asyncio
async def test_result_for_a_cancelled_import_is_dropped():
    """Cancelling a RUNNING import cannot interrupt the worker — there is no
    cancellation channel — so its result arrives after the fact anyway. It must
    not resurrect the import or write anything."""
    job, vision_import = _job(), _import()
    vision_import.status = VisionImportStatus.CANCELLED
    session = FakeSession(job, vision_import)

    await VisionResultService.handle(session, _done_message(job, vision_import))

    assert session.added == []
    assert job.status == VisionJobStatus.PENDING


@pytest.mark.asyncio
async def test_failure_is_terminal_and_never_requeues(session):
    """A screenshot that fails does so deterministically — a blurry image will be
    blurry again. No automatic retry: the job dies with its error, and the user
    decides whether to relaunch it (see the retry endpoint)."""
    vision_import, jobs = await _persist_import(
        session, total=2, statuses=(VisionJobStatus.PENDING, VisionJobStatus.PENDING)
    )
    job = jobs[0]
    message = VisionResultMessage(
        job_id=job.id, import_id=vision_import.id, status="failed", error="ocr blew up"
    )

    await VisionResultService.handle(session, message)

    assert job.status == VisionJobStatus.FAILED
    assert job.error == "ocr blew up"
    assert job.attempts == 1
    # A dead screenshot is still a finished one — otherwise the import never
    # reaches `done` and the user watches a spinner forever.
    assert vision_import.screens_done == 1


@pytest.mark.asyncio
async def test_a_failed_last_job_still_completes_the_import(session):
    vision_import, jobs = await _persist_import(
        session, total=1, statuses=(VisionJobStatus.PENDING,)
    )
    job = jobs[0]
    message = VisionResultMessage(
        job_id=job.id, import_id=vision_import.id, status="failed", error="not a roster"
    )

    await VisionResultService.handle(session, message)

    assert vision_import.status == VisionImportStatus.DONE


@pytest.mark.asyncio
async def test_retry_requeues_the_job_and_rewinds_the_progress(session):
    """The failed job already counted as finished. Relaunching it must undo that,
    or the import ends up `done` with a job still running, and screens_done
    overshoots screens_total when the result comes back."""
    vision_import, jobs = await _persist_import(
        session, total=2, statuses=(VisionJobStatus.FAILED, VisionJobStatus.DONE)
    )
    vision_import.status = VisionImportStatus.DONE
    job = jobs[0]
    job.error = "not a roster"
    publisher = FakePublisher()

    await VisionResultService.retry_job(session, publisher, job, vision_import)

    assert publisher.published == [job.id]
    assert job.status == VisionJobStatus.PENDING
    assert job.error is None
    assert vision_import.screens_done == 1
    assert vision_import.status == VisionImportStatus.RUNNING


@pytest.mark.asyncio
async def test_retry_of_the_only_job_puts_the_import_back_to_pending(session):
    vision_import, jobs = await _persist_import(
        session, total=1, statuses=(VisionJobStatus.FAILED,)
    )
    vision_import.status = VisionImportStatus.DONE

    await VisionResultService.retry_job(session, FakePublisher(), jobs[0], vision_import)

    assert vision_import.screens_done == 0
    assert vision_import.status == VisionImportStatus.PENDING


@pytest.mark.asyncio
async def test_retry_reverts_to_failed_when_publish_fails(session):
    """A publish failure after the rewind-commit must not strand the job: only
    FAILED jobs are retryable, so a job left PENDING-but-unqueued would be
    unreachable forever. The revert must restore the exact pre-retry state."""
    vision_import, jobs = await _persist_import(
        session, total=2, statuses=(VisionJobStatus.FAILED, VisionJobStatus.DONE)
    )
    vision_import.status = VisionImportStatus.DONE
    job = jobs[0]
    job.error = "not a roster"

    publisher = RaisingPublisher()

    with pytest.raises(HTTPException) as exc_info:
        await VisionResultService.retry_job(session, publisher, job, vision_import)

    assert exc_info.value.status_code == 503
    assert job.status == VisionJobStatus.FAILED
    assert job.error == JOB_NEVER_QUEUED
    assert vision_import.screens_done == 2
    assert vision_import.status == VisionImportStatus.DONE


@pytest.mark.asyncio
async def test_succeed_persists_candidates(session):

    job = await _make_job(session)
    message = VisionResultMessage.model_validate(
        {
            "job_id": str(job.id),
            "import_id": str(job.import_id),
            "status": "done",
            "predictions": [
                {
                    "champion_name": "Gladiator",
                    "confidence": 0.79,
                    "candidates": [
                        {"name": "Gladiator", "score": 0.79},
                        {"name": "Gorr", "score": 0.78},
                    ],
                }
            ],
        }
    )

    VisionResultService._succeed(session, job, message)
    await session.commit()

    stored = (
        await session.exec(
            select(VisionPredictionCandidate).order_by(VisionPredictionCandidate.position)
        )
    ).all()
    assert [(c.name, c.score, c.position) for c in stored] == [
        ("Gladiator", 0.79, 0),
        ("Gorr", 0.78, 1),
    ]

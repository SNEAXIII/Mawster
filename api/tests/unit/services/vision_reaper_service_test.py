import uuid

import pytest

from src.models.VisionJob import VisionJob, VisionJobStatus
from src.services.account.game.VisionReaperService import VisionReaperService


class FakePublisher:
    def __init__(self):
        self.published: list[uuid.UUID] = []

    async def publish_job(self, job_id, import_id, bucket, object_key) -> None:
        self.published.append(job_id)


class FakeResult:
    def __init__(self, rows):
        self._rows = rows

    def all(self):
        return self._rows


class FakeSession:
    """Returns the given jobs from any select()."""

    def __init__(self, jobs):
        self._jobs = jobs

    async def exec(self, _statement):
        return FakeResult(self._jobs)


def _job(status=VisionJobStatus.PENDING, attempts=0) -> VisionJob:
    job = VisionJob(import_id=uuid.uuid4(), object_key="imports/a/b/screen.png")
    job.status = status
    job.attempts = attempts
    return job


@pytest.mark.asyncio
async def test_requeues_pending_jobs():
    jobs = [_job(), _job()]
    session, publisher = FakeSession(jobs), FakePublisher()

    count = await VisionReaperService.requeue_pending(session, publisher)

    assert count == 2
    assert len(publisher.published) == 2


@pytest.mark.asyncio
async def test_skips_jobs_at_the_attempt_ceiling():
    """A job that already burned its attempts is not resurrected forever."""
    from src.messaging.topology import MAX_ATTEMPTS

    jobs = [_job(attempts=MAX_ATTEMPTS)]
    session, publisher = FakeSession(jobs), FakePublisher()

    count = await VisionReaperService.requeue_pending(session, publisher)

    assert count == 0
    assert publisher.published == []

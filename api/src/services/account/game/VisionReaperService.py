import logging

from sqlmodel import select

from src.messaging.publisher import VisionPublisher
from src.messaging.topology import MAX_ATTEMPTS
from src.models.VisionJob import VisionJob, VisionJobStatus
from src.security.secrets import SECRET
from src.utils.db import SessionDep

logger = logging.getLogger(__name__)


class VisionReaperService:
    """Requeues vision jobs stranded in PENDING at API startup.

    If the process is killed between the DB commit and the AMQP publish, a job
    row exists as PENDING but no message was ever sent. Nothing would ever pick
    it up, and the import sits unfinished forever. On startup we re-publish those
    jobs; the worker and result handler are idempotent, so re-publishing a job
    whose message is somehow still queued is harmless.
    """

    @classmethod
    async def requeue_pending(cls, session: SessionDep, publisher: VisionPublisher) -> int:
        statement = select(VisionJob).where(
            VisionJob.status == VisionJobStatus.PENDING,
            VisionJob.attempts < MAX_ATTEMPTS,
        )
        jobs = (await session.exec(statement)).all()
        count = 0
        for job in jobs:
            if job.attempts >= MAX_ATTEMPTS:
                # Defense in depth: the query already filters this, but a job
                # could reach the ceiling between the SELECT and here (or the
                # underlying session/query behave unexpectedly). Never resurrect
                # a job that already burned its attempts.
                continue
            try:
                await publisher.publish_job(
                    job_id=job.id,
                    import_id=job.import_id,
                    bucket=SECRET.RUSTFS_BUCKET_VISION,
                    object_key=job.object_key,
                )
                count += 1
            except Exception:
                logger.exception("reaper failed to requeue job %s", job.id)
        if count:
            logger.info("reaper requeued %s pending vision job(s)", count)
        return count

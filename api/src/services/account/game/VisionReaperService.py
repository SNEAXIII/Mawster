import logging
from datetime import UTC, datetime, timedelta

from sqlmodel import select

from src.messaging.publisher import VisionPublisher
from src.messaging.topology import MAX_ATTEMPTS
from src.models.vision.VisionImport import VisionImport, VisionImportStatus
from src.models.vision.VisionJob import VisionJob, VisionJobStatus
from src.security.secrets import SECRET
from src.services.account.game.VisionImportService import UPLOAD_URL_TTL_SECONDS
from src.storage.base import Storage, import_prefix
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

    @classmethod
    async def cancel_stale_uploads(cls, session: SessionDep, storage: Storage) -> int:
        """Close out imports whose presigned URLs expired before anyone uploaded.

        A user who picks 30 screenshots and closes the tab leaves an import in
        AWAITING_UPLOAD with, at best, a few objects in the bucket. It can never
        be committed once the URLs die, so it is finished — it just does not know
        it. `get_current` already refuses to treat it as blocking, so this is not
        what unblocks the account; it exists so the import history shows a real
        terminal status instead of a batch that looks forever about to start.

        Marked CANCELLED rather than deleted, and the objects purged: the same
        trade-off `cancel_import` makes, for the same reason — the row is what
        keeps the hourly quota honest, the bytes are what cost.
        """
        cutoff = datetime.now(UTC) - timedelta(seconds=UPLOAD_URL_TTL_SECONDS)
        statement = select(VisionImport).where(
            VisionImport.status == VisionImportStatus.AWAITING_UPLOAD,
            VisionImport.created_at <= cutoff,
        )
        imports = (await session.exec(statement)).all()
        for vision_import in imports:
            vision_import.status = VisionImportStatus.CANCELLED
            session.add(vision_import)
        if not imports:
            return 0
        await session.commit()

        for vision_import in imports:
            try:
                await storage.delete_prefix(
                    SECRET.RUSTFS_BUCKET_VISION, import_prefix(vision_import.id)
                )
            except Exception:  # noqa: BLE001
                # Statuses are already committed; failing here would undo a
                # correct bookkeeping pass over a storage blip. The bucket's
                # J+7 lifecycle is the backstop, same as in cancel_import.
                logger.warning(
                    "could not purge objects for stale upload import %s", vision_import.id
                )
        logger.info("reaper cancelled %s stale awaiting-upload import(s)", len(imports))
        return len(imports)

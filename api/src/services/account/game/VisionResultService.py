import logging
from typing import TYPE_CHECKING

from fastapi import HTTPException
from starlette import status

from src.dto.account.game.dto_vision_result import VisionResultMessage
from src.Messages.vision_messages import BROKER_UNAVAILABLE, JOB_NEVER_QUEUED
from src.models.VisionImport import VisionImport, VisionImportStatus
from src.models.VisionJob import VisionJob, VisionJobStatus
from src.models.VisionPrediction import VisionPrediction
from src.models.VisionPredictionCandidate import VisionPredictionCandidate
from src.security.secrets import SECRET
from src.utils.db import SessionDep

if TYPE_CHECKING:
    # Deferred: src.messaging imports this module (consumer.py calls
    # VisionResultService.handle at runtime), so importing VisionPublisher
    # at module level here would close the cycle. It is only ever used as a
    # type below, so TYPE_CHECKING-only is enough.
    from src.messaging.publisher import VisionPublisher

logger = logging.getLogger(__name__)


class VisionResultService:
    """Applies one worker result to the database.

    This is the ONLY place a vision result touches the DB. The AMQP consumer is a
    thin transport around it, which is what makes this testable without a broker.
    """

    @classmethod
    async def handle(cls, session: SessionDep, message: VisionResultMessage) -> None:
        job = await session.get(VisionJob, message.job_id)
        if job is None:
            # The import was deleted while the worker was still working on it.
            # Ignore rather than raise: a raise would nack and loop forever.
            logger.warning("vision result for unknown job %s — ignoring", message.job_id)
            return
        if job.status in (VisionJobStatus.DONE, VisionJobStatus.FAILED):
            # AMQP is at-least-once: a redelivery will happen one day. Without this
            # guard, redelivering a terminal job would duplicate every prediction of
            # the screenshot (DONE) or double-count screens_done (FAILED). The retry
            # path is unaffected: it puts the job back to PENDING before requeueing it.
            logger.info("vision result for already-terminal job %s — ignoring", job.id)
            return

        vision_import = await session.get(VisionImport, message.import_id)
        if vision_import is None:
            logger.warning("vision result for unknown import %s — ignoring", message.import_id)
            return
        if vision_import.status == VisionImportStatus.CANCELLED:
            # Cancelling a RUNNING import cannot interrupt the worker — there is
            # no cancellation channel — so its result arrives afterwards anyway.
            # Drop it rather than resurrect the import or duplicate writes.
            logger.info(
                "dropping result for cancelled import %s (job %s)",
                vision_import.id,
                message.job_id,
            )
            return

        job.attempts += 1
        if message.status == "failed":
            cls._fail(session, job, message)
        else:
            cls._succeed(session, job, message)
        cls._advance(session, vision_import)

        await session.commit()

    @classmethod
    async def retry_job(
        cls,
        session: SessionDep,
        publisher: "VisionPublisher",
        job: VisionJob,
        vision_import: VisionImport,
    ) -> None:
        """Put a failed screenshot back on the queue, at the user's request.

        The failed job already counted towards `screens_done` (a dead screenshot
        is a finished one). Relaunching it has to rewind that, or the import sits
        at `done` with a job still running, and `screens_done` overshoots
        `screens_total` when the second result lands.
        """
        job.status = VisionJobStatus.PENDING
        job.error = None

        vision_import.screens_done = max(0, vision_import.screens_done - 1)
        vision_import.status = (
            VisionImportStatus.PENDING
            if vision_import.screens_done == 0
            else VisionImportStatus.RUNNING
        )

        await session.commit()

        try:
            await publisher.publish_job(
                job_id=job.id,
                import_id=vision_import.id,
                bucket=SECRET.RUSTFS_BUCKET_VISION,
                object_key=job.object_key,
            )
        except Exception as error:
            # A job left PENDING but never actually queued is unreachable AND
            # unrecoverable: only FAILED jobs are retryable (see the controller's
            # 409), so a broker blip here would strand it forever with no worker
            # ever picking it up and no way for the user to retry again. Revert
            # to FAILED — the state it was in before this call — so it stays
            # within the user's reach.
            job.status = VisionJobStatus.FAILED
            job.error = JOB_NEVER_QUEUED
            vision_import.screens_done += 1
            vision_import.status = cls._status_for_progress(vision_import)
            await session.commit()
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=BROKER_UNAVAILABLE
            ) from error

        logger.info("vision job %s relaunched by the user (attempt %s)", job.id, job.attempts)

    @classmethod
    def _succeed(cls, session: SessionDep, job: VisionJob, message: VisionResultMessage) -> None:
        for predicted in message.predictions:
            session.add(
                VisionPrediction(
                    job_id=job.id,
                    champion_name=predicted.champion_name,
                    champion_class=predicted.champion_class,
                    stars=predicted.stars,
                    rank=predicted.rank,
                    signature=predicted.signature,
                    ascension=predicted.ascension,
                    confidence=predicted.confidence,
                    crop_key=predicted.crop_key,
                    candidates=[
                        VisionPredictionCandidate(
                            name=candidate.name, score=candidate.score, position=position
                        )
                        for position, candidate in enumerate(predicted.candidates)
                    ],
                )
            )
        job.status = VisionJobStatus.DONE
        job.result_key = message.result_key
        job.error = None

    @classmethod
    def _fail(cls, session: SessionDep, job: VisionJob, message: VisionResultMessage) -> None:
        """A failure is terminal. There is no automatic retry, on purpose.

        A screenshot that fails does so deterministically — a blurry image will be
        blurry on the second try too, and the pipeline costs seconds of CPU. The
        job dies with its error, the review screen shows it in red, and the user
        relaunches it if the image was worth anything (see the retry endpoint).
        """
        job.status = VisionJobStatus.FAILED
        job.error = message.error
        logger.warning("vision job %s failed: %s", job.id, job.error)

    @classmethod
    def _advance(cls, session: SessionDep, vision_import: VisionImport) -> None:
        """A failed screenshot still counts as a finished one — otherwise the
        import never reaches `done` and the user watches a spinner forever."""
        vision_import.screens_done += 1
        vision_import.status = cls._status_for_progress(vision_import)

    @classmethod
    def _status_for_progress(cls, vision_import: VisionImport) -> VisionImportStatus:
        """DONE once every screenshot has landed (success or failure), RUNNING otherwise."""
        if vision_import.screens_done >= vision_import.screens_total:
            return VisionImportStatus.DONE
        return VisionImportStatus.RUNNING

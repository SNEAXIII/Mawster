import logging

from src.dto.account.game.dto_vision_result import VisionResultMessage
from src.models.VisionImport import VisionImport, VisionImportStatus
from src.models.VisionJob import VisionJob, VisionJobStatus
from src.models.VisionPrediction import VisionPrediction
from src.utils.db import SessionDep

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

        job.attempts += 1
        if message.status == "failed":
            cls._fail(session, job, message)
        else:
            cls._succeed(session, job, message)
        cls._advance(session, vision_import)

        await session.commit()

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
        if vision_import.screens_done >= vision_import.screens_total:
            vision_import.status = VisionImportStatus.DONE
        else:
            vision_import.status = VisionImportStatus.RUNNING

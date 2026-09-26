from sqlalchemy import update
from sqlmodel import col, func, select

from src.enums.VisionJobStatus import VisionJobStatus
from src.models.vision.VisionImport import VisionImport
from src.models.vision.VisionJob import VisionJob
from src.utils.db import SessionDep

TERMINAL_JOB_STATUSES = (VisionJobStatus.DONE, VisionJobStatus.FAILED)


class VisionProgressService:
    """Recomputes an import's progress from its jobs.

    `screens_done` used to be incremented in Python, which lost a count whenever
    two results landed at once — the API runs the `vision.results` consumer
    in-process and Swarm runs two replicas of it, so two handlers read the same
    value and wrote the same value+1. The import then sat one screenshot short of
    its total forever, which the front shows as a spinner that never stops.

    Counting instead of incrementing makes the jobs the single source of truth:
    the write is one atomic UPDATE, and it recomputes an absolute value, so an
    import whose counter already drifted heals on its next result.
    """

    @classmethod
    async def sync(cls, session: SessionDep, vision_import: VisionImport) -> None:
        """Re-derive `screens_done` and the status from the import's jobs.

        The flush is load-bearing: callers change a job's status right before,
        and the subquery counts rows, not ORM state.
        """
        await session.flush()

        finished = (
            select(func.count())
            .select_from(VisionJob)
            .where(
                VisionJob.import_id == vision_import.id,
                col(VisionJob.status).in_(TERMINAL_JOB_STATUSES),
            )
            .scalar_subquery()
        )
        await session.exec(
            update(VisionImport)
            .where(col(VisionImport.id) == vision_import.id)
            .values(screens_done=finished)
        )

        await session.refresh(vision_import)
        vision_import.status = vision_import.status_for_progress()

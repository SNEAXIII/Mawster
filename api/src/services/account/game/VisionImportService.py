import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional, TYPE_CHECKING

from fastapi import HTTPException, UploadFile
from sqlalchemy.orm import selectinload
from sqlmodel import func, select
from starlette import status

from src.Messages.vision_messages import (
    BROKER_UNAVAILABLE,
    JOB_NEVER_QUEUED,
    NO_SCREENS_PROVIDED,
    SCREEN_TOO_LARGE,
    TOO_MANY_SCREENS,
    UNSUPPORTED_SCREEN_TYPE,
)
from src.messaging.publisher import VisionPublisher
from src.models.VisionImport import VisionImport, VisionImportStatus
from src.models.VisionJob import VisionJob, VisionJobStatus
from src.security.secrets import SECRET
from src.services.account.game.VisionDatasetService import ConfirmedRow, VisionDatasetService
from src.storage.base import Storage, import_prefix, screen_key
from src.utils.db import SessionDep

if TYPE_CHECKING:
    from src.dto.account.game.dto_vision_predictions import VisionPredictionResponse

MAX_SCREENS_PER_IMPORT = 40
MAX_SCREEN_BYTES = 8 * 1024 * 1024
ALLOWED_CONTENT_TYPES = {"image/png", "image/jpeg", "image/webp"}

logger = logging.getLogger(__name__)


class VisionImportService:
    @classmethod
    def _validate_files(cls, files: list[UploadFile]) -> None:
        if not files:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=NO_SCREENS_PROVIDED)
        if len(files) > MAX_SCREENS_PER_IMPORT:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=TOO_MANY_SCREENS.format(count=len(files), maximum=MAX_SCREENS_PER_IMPORT),
            )

    @classmethod
    def _validate_content_type(cls, file: UploadFile) -> None:
        if file.content_type not in ALLOWED_CONTENT_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=UNSUPPORTED_SCREEN_TYPE.format(
                    filename=file.filename, content_type=file.content_type
                ),
            )

    @classmethod
    def _validate_size(cls, file: UploadFile, data: bytes) -> None:
        if len(data) > MAX_SCREEN_BYTES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=SCREEN_TOO_LARGE.format(
                    filename=file.filename, size=len(data), maximum=MAX_SCREEN_BYTES
                ),
            )

    @classmethod
    async def create_import(
        cls,
        session: SessionDep,
        storage: Storage,
        publisher: VisionPublisher,
        game_account_id: uuid.UUID,
        files: list[UploadFile],
        share_dataset: bool,
    ) -> VisionImport:
        """Store every screenshot, persist the batch, then publish one job per screen.

        Order matters: the rows are committed before anything is published, so a
        worker can never receive a job_id that does not exist in the database yet.
        """
        cls._validate_files(files)
        # Content type is known from headers alone: check every file before reading
        # or writing a single byte, so a bad file anywhere in the batch costs
        # nothing in I/O or storage.
        for file in files:
            cls._validate_content_type(file)

        vision_import = VisionImport(
            game_account_id=game_account_id,
            screens_total=len(files),
            share_dataset=share_dataset,
        )
        session.add(vision_import)

        jobs: list[VisionJob] = []
        try:
            for file in files:
                # Bounded read: caps memory at ~MAX_SCREEN_BYTES per file instead of
                # buffering an arbitrarily large upload before rejecting it.
                data = await file.read(MAX_SCREEN_BYTES + 1)
                cls._validate_size(file, data)
                job = VisionJob(import_id=vision_import.id, object_key="")
                job.object_key = screen_key(vision_import.id, job.id)
                await storage.put_bytes(
                    bucket=SECRET.RUSTFS_BUCKET_VISION,
                    key=job.object_key,
                    data=data,
                    content_type=file.content_type,
                )
                session.add(job)
                jobs.append(job)
        except Exception:
            # Nothing has been committed yet, so the DB is untouched, but earlier
            # screenshots in this batch may already be sitting in RustFS. Clean
            # them up so a rejected batch never leaks storage.
            if jobs:
                await storage.delete_prefix(
                    SECRET.RUSTFS_BUCKET_VISION, import_prefix(vision_import.id)
                )
            raise

        await session.commit()
        await session.refresh(vision_import)

        published_count = 0
        try:
            for job in jobs:
                await publisher.publish_job(
                    job_id=job.id,
                    import_id=vision_import.id,
                    bucket=SECRET.RUSTFS_BUCKET_VISION,
                    object_key=job.object_key,
                )
                published_count += 1
        except Exception as error:  # noqa: BLE001
            # Jobs already published are live in the broker and keep running to
            # completion; their predictions landing on a FAILED import is harmless
            # because predictions are staging data the user never confirms. Only
            # the unpublished tail is dangerous: without this, it sits at PENDING
            # forever with no publisher, no retry and no reconciliation. Mark it
            # FAILED here instead so the batch is fully accounted for.
            vision_import.status = VisionImportStatus.FAILED
            session.add(vision_import)
            for unpublished_job in jobs[published_count:]:
                unpublished_job.status = VisionJobStatus.FAILED
                unpublished_job.error = JOB_NEVER_QUEUED
                session.add(unpublished_job)
            await session.commit()
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=BROKER_UNAVAILABLE
            ) from error

        return vision_import

    @classmethod
    async def get_import(cls, session: SessionDep, import_id: uuid.UUID) -> VisionImport | None:
        result = await session.exec(
            select(VisionImport)
            .where(VisionImport.id == import_id)
            .options(selectinload(VisionImport.jobs).selectinload(VisionJob.predictions))
        )
        return result.first()

    @classmethod
    async def get_current(
        cls, session: SessionDep, game_account_id: uuid.UUID
    ) -> Optional[VisionImport]:
        """The single import that still needs attention for this game account.

        CONFIRMED and CANCELLED are done with. Imports older than the retention
        window have lost their screenshots and crops to the bucket lifecycle, so
        validating them would mean approving data whose evidence is gone.
        """
        cutoff = datetime.now(timezone.utc) - timedelta(days=SECRET.VISION_RETENTION_DAYS)
        statement = (
            select(VisionImport)
            .where(
                VisionImport.game_account_id == game_account_id,
                VisionImport.status.notin_(
                    [VisionImportStatus.CONFIRMED, VisionImportStatus.CANCELLED]
                ),
                VisionImport.created_at > cutoff,
            )
            .order_by(VisionImport.created_at.desc(), VisionImport.id.desc())
            .limit(1)
        )
        return (await session.exec(statement)).first()

    @classmethod
    async def count_predictions(cls, session: SessionDep, import_id: uuid.UUID) -> int:
        """How many champions were read across every job of this import."""
        from src.models.VisionJob import VisionJob
        from src.models.VisionPrediction import VisionPrediction

        statement = (
            select(func.count(VisionPrediction.id))
            .join(VisionJob, VisionJob.id == VisionPrediction.job_id)
            .where(VisionJob.import_id == import_id)
        )
        return (await session.exec(statement)).one()

    @classmethod
    async def list_predictions(
        cls, session: SessionDep, import_id: uuid.UUID
    ) -> list["VisionPredictionResponse"]:
        """All predictions of an import, ordered by job then id, carrying the crop
        index parsed out of the stored crop_key and a stable per-import job index."""
        from src.dto.account.game.dto_vision_predictions import VisionPredictionResponse
        from src.models.VisionPrediction import VisionPrediction

        jobs = (
            await session.exec(
                select(VisionJob)
                .where(VisionJob.import_id == import_id)
                .order_by(VisionJob.created_at)
            )
        ).all()
        job_index = {job.id: i for i, job in enumerate(jobs)}

        rows: list[VisionPredictionResponse] = []
        for job in jobs:
            preds = (
                await session.exec(
                    select(VisionPrediction)
                    .where(VisionPrediction.job_id == job.id)
                    .order_by(VisionPrediction.id)
                )
            ).all()
            for pred in preds:
                rows.append(
                    VisionPredictionResponse(
                        id=pred.id,
                        job_id=job.id,
                        champion_name=pred.champion_name,
                        champion_class=pred.champion_class,
                        stars=pred.stars,
                        rank=pred.rank,
                        signature=pred.signature,
                        ascension=pred.ascension,
                        confidence=pred.confidence,
                        crop_index=cls._crop_index(pred.crop_key),
                        job_index=job_index[job.id],
                    )
                )
        return rows

    @staticmethod
    def _crop_index(crop_key: str | None) -> int | None:
        """Parse the trailing crops/{n}.png index out of a stored crop key."""
        if not crop_key:
            return None
        try:
            return int(crop_key.rsplit("/", 1)[-1].removesuffix(".png"))
        except ValueError:
            return None

    @classmethod
    async def cancel_import(
        cls, session: SessionDep, storage: Storage, vision_import: VisionImport
    ) -> None:
        """Cancel an import: purge its RustFS objects, keep the row.

        The row is kept on purpose. The hourly quota counts rows, so deleting on
        cancel would let create -> cancel -> create slip under the limit forever.
        A row costs nothing; the objects are what cost, and those are purged.
        The predictions are kept too — they are the record of what the server was
        asked to do, and they are what makes the quota honest.
        """
        vision_import.status = VisionImportStatus.CANCELLED
        session.add(vision_import)
        await session.commit()
        try:
            await storage.delete_prefix(
                SECRET.RUSTFS_BUCKET_VISION, import_prefix(vision_import.id)
            )
        except Exception:  # noqa: BLE001
            # The status is already committed, so raising here would report a
            # failure for an import that IS cancelled. The bucket's J+7 retention
            # reaps whatever is left behind.
            logger.warning("could not purge objects for cancelled import %s", vision_import.id)

    @classmethod
    async def confirm(
        cls,
        session: SessionDep,
        storage: Storage,
        vision_import: VisionImport,
        rows: list[ConfirmedRow],
    ) -> int:
        """Archive the dataset (if opted in) and mark the import confirmed.

        The roster itself is written by the frontend via bulkUpdateRoster —
        this does NOT touch ChampionUser, to keep a single writer of roster
        truth.

        Idempotent: a retry (network timeout, double-click) on an import that
        is already CONFIRMED is a no-op — no new samples archived, nothing
        written to storage, no status rewrite. Without this guard, a retry
        would re-archive the same samples into the permanent dataset bucket,
        leaving duplicates there forever.
        """
        if vision_import.status == VisionImportStatus.CONFIRMED:
            return 0
        archived = await VisionDatasetService.archive(session, storage, vision_import, rows)
        vision_import.status = VisionImportStatus.CONFIRMED
        session.add(vision_import)
        await session.commit()
        return archived

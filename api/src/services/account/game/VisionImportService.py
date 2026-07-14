import uuid

from fastapi import HTTPException, UploadFile
from sqlalchemy.orm import selectinload
from sqlmodel import select
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
from src.storage.base import Storage, import_prefix, screen_key
from src.utils.db import SessionDep

MAX_SCREENS_PER_IMPORT = 40
MAX_SCREEN_BYTES = 8 * 1024 * 1024
ALLOWED_CONTENT_TYPES = {"image/png", "image/jpeg", "image/webp"}


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
    async def delete_import(
        cls, session: SessionDep, storage: Storage, vision_import: VisionImport
    ) -> None:
        """Delete an import, its jobs, their predictions and the RustFS objects.

        There is no DB-level cascade from vision_prediction to vision_job (kept
        out of the migration deliberately), so predictions must be deleted before
        their parent jobs or the FK raises IntegrityError. Callers must fetch
        vision_import via get_import, which eager-loads jobs and predictions.
        """
        for job in vision_import.jobs:
            for prediction in job.predictions:
                await session.delete(prediction)
        for job in vision_import.jobs:
            await session.delete(job)
        await session.delete(vision_import)
        await session.commit()
        await storage.delete_prefix(SECRET.RUSTFS_BUCKET_VISION, import_prefix(vision_import.id))

import uuid

from fastapi import HTTPException, UploadFile
from sqlalchemy.orm import selectinload
from sqlmodel import select
from starlette import status

from src.Messages.vision_messages import (
    BROKER_UNAVAILABLE,
    NO_SCREENS_PROVIDED,
    SCREEN_TOO_LARGE,
    TOO_MANY_SCREENS,
    UNSUPPORTED_SCREEN_TYPE,
)
from src.messaging.publisher import VisionPublisher
from src.models.VisionImport import VisionImport, VisionImportStatus
from src.models.VisionJob import VisionJob
from src.security.secrets import SECRET
from src.storage.base import Storage, screen_key
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
    def _validate_one(cls, file: UploadFile, data: bytes) -> None:
        if len(data) > MAX_SCREEN_BYTES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=SCREEN_TOO_LARGE.format(
                    filename=file.filename, size=len(data), maximum=MAX_SCREEN_BYTES
                ),
            )
        if file.content_type not in ALLOWED_CONTENT_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=UNSUPPORTED_SCREEN_TYPE.format(
                    filename=file.filename, content_type=file.content_type
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

        vision_import = VisionImport(
            game_account_id=game_account_id,
            screens_total=len(files),
            share_dataset=share_dataset,
        )
        session.add(vision_import)

        jobs: list[VisionJob] = []
        for file in files:
            data = await file.read()
            cls._validate_one(file, data)
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

        await session.commit()
        await session.refresh(vision_import)

        try:
            for job in jobs:
                await publisher.publish_job(
                    job_id=job.id,
                    import_id=vision_import.id,
                    bucket=SECRET.RUSTFS_BUCKET_VISION,
                    object_key=job.object_key,
                )
        except Exception as error:  # noqa: BLE001
            vision_import.status = VisionImportStatus.FAILED
            session.add(vision_import)
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
            .options(selectinload(VisionImport.jobs))
        )
        return result.first()

    @classmethod
    async def delete_import(cls, session: SessionDep, vision_import: VisionImport) -> None:
        for job in vision_import.jobs:
            await session.delete(job)
        await session.delete(vision_import)
        await session.commit()

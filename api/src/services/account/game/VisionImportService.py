import logging
import uuid
from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING

from fastapi import HTTPException, UploadFile
from sqlalchemy import or_
from sqlalchemy.orm import selectinload
from sqlmodel import func, select
from starlette import status

from src.dto.account.game.dto_vision_predictions import (
    VisionCandidateResponse,
    VisionPredictionResponse,
)
from src.dto.account.game.dto_vision_upload import (
    VisionInitResponse,
    VisionScreenDeclaration,
    VisionUploadTarget,
)
from src.Messages.vision_messages import (
    BROKER_UNAVAILABLE,
    JOB_NEVER_QUEUED,
    NO_SCREENS_PROVIDED,
    SCREEN_NOT_AN_IMAGE,
    SCREEN_NOT_UPLOADED,
    SCREEN_TOO_LARGE,
    SCREEN_TYPE_MISMATCH,
    TOO_MANY_SCREENS,
    UNSUPPORTED_SCREEN_TYPE,
    VISION_JOB_NOT_FOUND,
)
from src.messaging.publisher import VisionPublisher
from src.models.user.GameAccount import GameAccount
from src.models.vision.VisionImport import VisionImport, VisionImportStatus
from src.models.vision.VisionJob import VisionJob, VisionJobStatus
from src.models.vision.VisionPrediction import VisionPrediction
from src.security.secrets import SECRET
from src.services.account.game.VisionDatasetService import ConfirmedRow, VisionDatasetService
from src.storage.base import Storage, import_prefix, screen_key
from src.utils.db import SessionDep

if TYPE_CHECKING:
    from src.dto.account.game.dto_vision_predictions import VisionPredictionResponse
    from src.models.vision.VisionPredictionCandidate import VisionPredictionCandidate

MAX_SCREENS_PER_IMPORT = 40
MAX_SCREEN_BYTES = 8 * 1024 * 1024
ALLOWED_CONTENT_TYPES = {"image/png", "image/jpeg", "image/webp"}

# How long a presigned upload URL stays valid. Sized for the worst realistic
# batch, not the median: MAX_SCREENS_PER_IMPORT files of MAX_SCREEN_BYTES over a
# phone connection is a few hundred megabytes, and a URL that dies mid-batch
# costs the user the whole import. Beyond this the import can never be
# committed, which is what makes it safe for `get_current` to stop counting it
# as blocking.
UPLOAD_URL_TTL_SECONDS = 15 * 60

# Enough to cover the longest signature checked by `_sniff_image_type`: WebP
# needs bytes 8..11.
MAGIC_PREFIX_BYTES = 12

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

        await cls._publish_batch(session, publisher, vision_import, jobs)
        return vision_import

    @classmethod
    async def _publish_batch(
        cls,
        session: SessionDep,
        publisher: VisionPublisher,
        vision_import: VisionImport,
        jobs: list[VisionJob],
    ) -> None:
        """Publish one message per job, accounting for a mid-batch broker failure.

        The multipart path only. It fails the import as a whole because there the
        batch really is atomic — every screenshot was accepted in one request, so
        a broker that dies halfway leaves a batch that was never viable. The
        presigned path publishes screenshot by screenshot through `_publish_one`,
        where a failure costs one screenshot and not the import.
        """
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
        except Exception as error:
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

    @classmethod
    async def init_import(
        cls,
        session: SessionDep,
        storage: Storage,
        game_account_id: uuid.UUID,
        screens: list[VisionScreenDeclaration],
        share_dataset: bool,
    ) -> VisionInitResponse:
        """Reserve an import and hand back one presigned PUT URL per screenshot.

        Nothing is queued here: the objects do not exist yet. The import and its
        jobs sit in AWAITING_UPLOAD until `commit_import` confirms the bytes
        landed, which is what keeps the worker from ever being pointed at a key
        with nothing behind it.

        The object keys are derived server-side from ids the caller does not
        choose. A client-supplied key would be a write primitive into any other
        user's import — the same reasoning that keeps `get_crop_sprite` from
        accepting one.
        """
        cls._validate_declarations(screens)

        vision_import = VisionImport(
            game_account_id=game_account_id,
            screens_total=len(screens),
            share_dataset=share_dataset,
            status=VisionImportStatus.AWAITING_UPLOAD,
        )
        session.add(vision_import)

        jobs: list[VisionJob] = []
        for screen in screens:
            job = VisionJob(
                import_id=vision_import.id,
                object_key="",
                filename=screen.filename,
                status=VisionJobStatus.AWAITING_UPLOAD,
            )
            job.object_key = screen_key(vision_import.id, job.id)
            session.add(job)
            jobs.append(job)

        # Committed before signing: a URL whose job row does not exist would let
        # a client write an object that `commit` can never account for, and that
        # the retention sweep is the only thing left to clean up.
        await session.commit()
        await session.refresh(vision_import)

        uploads = [
            VisionUploadTarget(
                job_id=job.id,
                filename=screen.filename,
                url=await storage.presigned_put_url(
                    bucket=SECRET.RUSTFS_BUCKET_VISION,
                    key=job.object_key,
                    content_type=screen.content_type,
                    expires_in=UPLOAD_URL_TTL_SECONDS,
                ),
                content_type=screen.content_type,
            )
            for job, screen in zip(jobs, screens, strict=True)
        ]
        return VisionInitResponse(
            import_id=vision_import.id,
            expires_in=UPLOAD_URL_TTL_SECONDS,
            uploads=uploads,
        )

    @classmethod
    def _validate_declarations(cls, screens: list[VisionScreenDeclaration]) -> None:
        """Reject a batch on its claims alone, before a single URL is signed.

        Cheap gate, not a security boundary: every one of these numbers comes
        from the client and is re-established from the stored object in
        `commit_import`. Its job is to fail fast, so a user does not upload
        40 files only to be told at commit that the second one was too big.
        """
        if not screens:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=NO_SCREENS_PROVIDED)
        if len(screens) > MAX_SCREENS_PER_IMPORT:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=TOO_MANY_SCREENS.format(count=len(screens), maximum=MAX_SCREENS_PER_IMPORT),
            )
        for screen in screens:
            if screen.content_type not in ALLOWED_CONTENT_TYPES:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=UNSUPPORTED_SCREEN_TYPE.format(
                        filename=screen.filename, content_type=screen.content_type
                    ),
                )
            if screen.size > MAX_SCREEN_BYTES:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=SCREEN_TOO_LARGE.format(
                        filename=screen.filename, size=screen.size, maximum=MAX_SCREEN_BYTES
                    ),
                )

    @classmethod
    async def commit_screen(
        cls,
        session: SessionDep,
        storage: Storage,
        publisher: VisionPublisher,
        vision_import: VisionImport,
        job_id: uuid.UUID,
    ) -> VisionJob:
        """Verify one uploaded screenshot and queue it on its own.

        Called by the browser the moment a single PUT lands, so the worker starts
        on screenshot 1 while screenshot 12 is still climbing the user's uplink.
        The whole batch used to wait for its slowest file before anything was
        queued; the GPU time of every screenshot but the last now hides behind
        the upload.

        This is where the trust lost by not seeing the upload is bought back. A
        presigned PUT can pin the content type into the signature but cannot cap
        the size, so both are re-derived here from what RustFS actually stored,
        and the first bytes are sniffed because a declared `image/png` proves
        nothing about the file behind it.

        Idempotent: a job that already left AWAITING_UPLOAD is returned as-is
        rather than published twice, which covers a double-click, a retried
        request, and `commit_import` sweeping a job this call already queued.

        A screenshot that fails verification is left in AWAITING_UPLOAD and the
        400 goes back to the browser. It is NOT failed here: the user may still
        retry the PUT against a URL that is good for fifteen minutes, and
        `commit_import` is what decides that a screenshot never made it.
        """
        job = await session.get(VisionJob, job_id)
        if job is None or job.import_id != vision_import.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=VISION_JOB_NOT_FOUND)
        if job.status != VisionJobStatus.AWAITING_UPLOAD:
            return job

        await cls._verify_uploaded(storage, job)

        # Committed before publishing, same as the batch path: a worker must
        # never receive a job_id whose row is still AWAITING_UPLOAD.
        job.status = VisionJobStatus.PENDING
        session.add(job)
        # The first screenshot to be queued takes the import with it. Written
        # here rather than after the publish, and only ever upward from
        # AWAITING_UPLOAD, because a worker result racing this call owns the
        # status from then on — overwriting it from a stale read is how an import
        # loses its DONE and never gets it back.
        if vision_import.status == VisionImportStatus.AWAITING_UPLOAD:
            vision_import.status = VisionImportStatus.PENDING
            session.add(vision_import)
        await session.commit()

        await cls._publish_one(session, publisher, vision_import, job)
        return job

    @classmethod
    async def _publish_one(
        cls,
        session: SessionDep,
        publisher: VisionPublisher,
        vision_import: VisionImport,
        job: VisionJob,
    ) -> None:
        """Queue a single job, accounting for it if the broker refuses.

        The count matters more than it looks: a job that is never published
        produces no worker result, and the worker result is the only thing that
        ever increments `screens_done`. Without the increment here the import
        would sit one screenshot short of its total forever, which reads as a
        spinner that never stops.
        """
        try:
            await publisher.publish_job(
                job_id=job.id,
                import_id=vision_import.id,
                bucket=SECRET.RUSTFS_BUCKET_VISION,
                object_key=job.object_key,
            )
        except Exception as error:
            cls._fail_unqueued(session, vision_import, job)
            await session.commit()
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=BROKER_UNAVAILABLE
            ) from error

    @classmethod
    def _fail_unqueued(
        cls, session: SessionDep, vision_import: VisionImport, job: VisionJob
    ) -> None:
        """Mark a job that will never reach a worker, and advance the import past it."""
        job.status = VisionJobStatus.FAILED
        job.error = JOB_NEVER_QUEUED
        vision_import.screens_done += 1
        vision_import.status = vision_import.status_for_progress()
        session.add(job)
        session.add(vision_import)

    @classmethod
    async def commit_import(
        cls,
        session: SessionDep,
        storage: Storage,
        publisher: VisionPublisher,
        vision_import: VisionImport,
    ) -> VisionImport:
        """Seal the import: settle every screenshot the per-screen commits left behind.

        By the time the browser calls this, most jobs are already PENDING,
        RUNNING or DONE. What is left in AWAITING_UPLOAD is a screenshot whose
        PUT failed, or one whose `commit_screen` call was lost — so each is given
        one last verify-and-publish, and whatever still does not stand up is
        failed for good.

        Failing them individually instead of rejecting the whole batch is forced
        by the pipelining: the jobs that did upload are already running in the
        worker and cannot be recalled. The import finishes with a hole in it,
        which the review screen shows as a failed screenshot the user can
        relaunch, rather than a 400 that describes work that is happening anyway.

        Idempotent: with nothing left in AWAITING_UPLOAD this only recomputes the
        import status, so a double-click cannot queue a screenshot twice.
        """
        if vision_import.status in (VisionImportStatus.CONFIRMED, VisionImportStatus.CANCELLED):
            return vision_import

        jobs = (
            await session.exec(
                select(VisionJob)
                .where(VisionJob.import_id == vision_import.id)
                .order_by(VisionJob.created_at)
            )
        ).all()
        # Filtered here rather than in the WHERE clause: every other job in this
        # import is already queued or finished, and re-publishing one of those is
        # exactly the duplicate this method must never create. Keeping the test
        # in Python puts it next to the loop that depends on it.
        leftover = [job for job in jobs if job.status == VisionJobStatus.AWAITING_UPLOAD]

        for job in leftover:
            try:
                await cls._verify_uploaded(storage, job)
            except HTTPException as error:
                job.status = VisionJobStatus.FAILED
                job.error = str(error.detail)
                vision_import.screens_done += 1
                session.add(job)
                continue
            job.status = VisionJobStatus.PENDING
            session.add(job)

        vision_import.status = vision_import.status_for_progress()
        session.add(vision_import)
        await session.commit()
        await session.refresh(vision_import)

        # Published after the commit, and one at a time: a broker failure on the
        # third of these must leave the first two queued and running, exactly as
        # if their per-screen commits had gone through.
        for job in leftover:
            if job.status == VisionJobStatus.PENDING:
                await cls._publish_one(session, publisher, vision_import, job)
        return vision_import

    @classmethod
    async def _verify_uploaded(cls, storage: Storage, job: VisionJob) -> None:
        """Fail the commit unless this job's object is a real, in-budget image.

        Raises rather than returning a verdict: a batch is queued whole or not at
        all, and a partially valid import would leave the user reviewing a roster
        with silent holes in it.
        """
        filename = job.filename or job.object_key
        stat = await storage.stat_object(SECRET.RUSTFS_BUCKET_VISION, job.object_key)
        if stat is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=SCREEN_NOT_UPLOADED.format(filename=filename),
            )
        if stat.size > MAX_SCREEN_BYTES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=SCREEN_TOO_LARGE.format(
                    filename=filename, size=stat.size, maximum=MAX_SCREEN_BYTES
                ),
            )
        if stat.content_type not in ALLOWED_CONTENT_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=UNSUPPORTED_SCREEN_TYPE.format(
                    filename=filename, content_type=stat.content_type
                ),
            )
        head = await storage.get_head_bytes(
            SECRET.RUSTFS_BUCKET_VISION, job.object_key, MAGIC_PREFIX_BYTES
        )
        sniffed = cls._sniff_image_type(head)
        if sniffed is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=SCREEN_NOT_AN_IMAGE.format(filename=filename),
            )
        if sniffed != stat.content_type:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=SCREEN_TYPE_MISMATCH.format(
                    filename=filename, actual=sniffed, declared=stat.content_type
                ),
            )

    @staticmethod
    def _sniff_image_type(head: bytes) -> str | None:
        """The real type of a file from its first bytes, or None if not an image.

        Only the three formats the pipeline can open. Deliberately not Pillow:
        this runs on up to 40 objects per commit and must not decode anything —
        it answers "is this plausibly the format it claims", and the worker is
        the one that finds out whether the image is actually readable.
        """
        if head.startswith(b"\x89PNG\r\n\x1a\n"):
            return "image/png"
        if head.startswith(b"\xff\xd8\xff"):
            return "image/jpeg"
        # RIFF container, WEBP form type at offset 8 — the 4 bytes between are
        # the file length, which says nothing about the format.
        if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
            return "image/webp"
        return None

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
    ) -> VisionImport | None:
        """The single import that still needs attention for this game account.

        CONFIRMED and CANCELLED are done with. Imports older than the retention
        window have lost their screenshots and crops to the bucket lifecycle, so
        validating them would mean approving data whose evidence is gone.

        An import with a screenshot still awaiting its upload counts as blocking
        only while its presigned URLs can still be used. Past that it can never
        be completed — no upload can succeed against dead URLs, so that
        screenshot's job will never be queued and `screens_done` will never reach
        its total — and leaving it in the way would lock the game account out of
        importing for the whole retention window every time someone closed the
        tab mid-upload. It still counts against the hourly quota, because that
        measures work asked of the server.

        The test is on the jobs, not on the import's own status: since each
        screenshot is queued the moment it lands, an import whose first
        screenshot already came back reads as RUNNING while the rest of the batch
        is still uploading. Reading the import status alone would call that one
        blocking forever.
        """
        now = datetime.now(UTC)
        cutoff = now - timedelta(days=SECRET.VISION_RETENTION_DAYS)
        upload_cutoff = now - timedelta(seconds=UPLOAD_URL_TTL_SECONDS)
        has_pending_upload = (
            select(VisionJob.id)
            .where(
                VisionJob.import_id == VisionImport.id,
                VisionJob.status == VisionJobStatus.AWAITING_UPLOAD,
            )
            .exists()
        )
        statement = (
            select(VisionImport)
            .where(
                VisionImport.game_account_id == game_account_id,
                VisionImport.status.notin_(
                    [VisionImportStatus.CONFIRMED, VisionImportStatus.CANCELLED]
                ),
                VisionImport.created_at > cutoff,
                or_(~has_pending_upload, VisionImport.created_at > upload_cutoff),
            )
            .order_by(VisionImport.created_at.desc(), VisionImport.id.desc())
            .limit(1)
        )
        return (await session.exec(statement)).first()

    @classmethod
    async def count_recent_imports(
        cls, session: SessionDep, user_id: uuid.UUID, hours: int = 1
    ) -> int:
        """Imports this user created in the last `hours`, across all their game
        accounts and whatever their status.

        Counted in the DB on purpose: an in-process limiter (slowapi) is per
        worker, so two uvicorn workers would double the real limit and a restart
        would reset it. Cancelled imports count too — the quota measures work
        asked of the server, not work kept.
        """

        cutoff = datetime.now(UTC) - timedelta(hours=hours)
        statement = (
            select(func.count(VisionImport.id))
            .join(GameAccount, GameAccount.id == VisionImport.game_account_id)
            .where(GameAccount.user_id == user_id, VisionImport.created_at > cutoff)
        )
        return (await session.exec(statement)).one()

    @classmethod
    async def count_predictions(cls, session: SessionDep, import_id: uuid.UUID) -> int:
        """How many champions were read across every job of this import."""

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
                    # Without this, a 48-row review fires 48 extra queries — and
                    # on AsyncSession lazy loading raises rather than merely
                    # being slow, so the review would break outright.
                    .options(selectinload(VisionPrediction.candidates))
                    .order_by(VisionPrediction.id)
                )
            ).all()
            rows.extend(
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
                    candidates=[
                        VisionCandidateResponse(name=c.name, score=c.score) for c in pred.candidates
                    ],
                    margin=cls._margin(pred.candidates),
                    reranked=pred.reranked,
                )
                for pred in preds
            )
        return rows

    @staticmethod
    def _margin(candidates: list["VisionPredictionCandidate"]) -> float | None:
        """Signed gap between the winner and the runner-up, None below two rows.

        This is the real confidence signal. Measured on ground truth, both
        misreads scored 0.79 — high enough for a score-based threshold to paint
        them green — while sitting 0.01 ahead of the right answer. The absolute
        score says almost nothing; this gap says whether the model actually knew.

        It goes **negative** when the pixel second pass reordered the shortlist:
        the scores stay CLIP cosines, so the card's winner is no longer the
        highest of them. That is not a bug and not an ambiguity either — pair it
        with `reranked` to tell "the model was corrected" from "the model was
        unsure".

        Assumes `candidates` is ordered by `position`. The relationship declares
        that ordering, and every query that loads it must preserve it.
        """
        if len(candidates) < 2:
            return None
        return candidates[0].score - candidates[1].score

    @staticmethod
    def _crop_index(crop_key: str | None) -> int | None:
        """Parse the sprite cell index out of a stored crop key.

        One shape only: `.../crops/sprite_v1.webp#{cell}`, written by the current
        worker. The index is not a column and never was — it rides along in the
        key string, which is why the sprite sheet needed no migration.

        A key without a `#` is a per-crop key from the pre-sprite worker. It
        yields `None` because the object it names no longer has a route to fetch
        it: `None` is exactly the signal the front already renders as the
        champion portrait, so such a row degrades to the fallback instead of
        pointing at bytes nothing can serve.
        """
        if not crop_key or "#" not in crop_key:
            return None
        try:
            return int(crop_key.rsplit("#", 1)[-1])
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
        share_dataset: bool,
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
        # The review-screen opt-in is authoritative: it overrides whatever was
        # (never) set at upload, so archive() reads the user's actual choice.
        vision_import.share_dataset = share_dataset
        archived = await VisionDatasetService.archive(session, storage, vision_import, rows)
        vision_import.status = VisionImportStatus.CONFIRMED
        session.add(vision_import)
        await session.commit()
        return archived

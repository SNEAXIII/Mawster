import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from starlette import status

from src.Messages.game_account_messages import GAME_ACCOUNT_NOT_FOUND
from src.Messages.vision_messages import (
    JOB_NOT_RETRYABLE,
    NOT_YOUR_VISION_IMPORT,
    VISION_IMPORT_NOT_FOUND,
    VISION_JOB_NOT_FOUND,
)
from src.dto.account.game.dto_vision import (
    VisionImportDetailResponse,
    VisionImportResponse,
)
from src.dto.account.game.dto_vision_predictions import VisionPredictionsResponse
from src.messaging import get_publisher
from src.messaging.publisher import VisionPublisher
from src.models import User
from src.models.VisionImport import VisionImport
from src.models.VisionJob import VisionJob, VisionJobStatus
from src.security.secrets import SECRET
from src.services.account.game.GameAccountService import GameAccountService
from src.services.account.game.VisionDatasetService import ConfirmedRow
from src.services.account.game.VisionImportService import VisionImportService
from src.services.account.game.VisionResultService import VisionResultService
from src.services.auth.AuthService import AuthService
from src.storage import get_storage
from src.storage.base import Storage, crop_key
from src.utils.db import SessionDep

vision_controller = APIRouter(
    prefix="/vision",
    tags=["Vision"],
    dependencies=[Depends(AuthService.get_current_user_in_jwt)],
)


class PresignedUrlResponse(BaseModel):
    url: str


class VisionConfirmRequest(BaseModel):
    rows: list[ConfirmedRow]


class VisionConfirmResponse(BaseModel):
    samples_archived: int


async def _get_own_import(
    session: SessionDep,
    import_id: uuid.UUID,
    current_user_id: uuid.UUID,
) -> VisionImport:
    """Load an import and verify it belongs to the current user. Raises 404/403."""
    vision_import = await VisionImportService.get_import(session, import_id)
    if vision_import is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=VISION_IMPORT_NOT_FOUND)
    game_account = await GameAccountService.get_game_account(session, vision_import.game_account_id)
    if game_account is None or game_account.user_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=NOT_YOUR_VISION_IMPORT)
    return vision_import


@vision_controller.post(
    "/imports", response_model=VisionImportResponse, status_code=status.HTTP_201_CREATED
)
async def create_vision_import(
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
    storage: Annotated[Storage, Depends(get_storage)],
    publisher: Annotated[VisionPublisher, Depends(get_publisher)],
    game_account_id: Annotated[uuid.UUID, Form()],
    files: Annotated[list[UploadFile], File()],
    share_dataset: Annotated[bool, Form()] = False,
):
    """Upload roster screenshots and queue them for extraction."""
    game_account = await GameAccountService.get_game_account(session, game_account_id)
    if game_account is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=GAME_ACCOUNT_NOT_FOUND)
    if game_account.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only import screenshots into your own game accounts",
        )
    return await VisionImportService.create_import(
        session=session,
        storage=storage,
        publisher=publisher,
        game_account_id=game_account_id,
        files=files,
        share_dataset=share_dataset,
    )


@vision_controller.get("/imports/{import_id}", response_model=VisionImportDetailResponse)
async def get_vision_import(
    session: SessionDep,
    import_id: uuid.UUID,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Progress of an import. The front polls this while the batch runs."""
    return await _get_own_import(session, import_id, current_user.id)


@vision_controller.get("/imports/{import_id}/predictions", response_model=VisionPredictionsResponse)
async def get_vision_predictions(
    session: SessionDep,
    import_id: uuid.UUID,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """All predictions of an import, feeding the review screen's preview rows."""
    await _get_own_import(session, import_id, current_user.id)
    predictions = await VisionImportService.list_predictions(session, import_id)
    return VisionPredictionsResponse(import_id=import_id, predictions=predictions)


@vision_controller.post("/imports/{import_id}/confirm", response_model=VisionConfirmResponse)
async def confirm_vision_import(
    session: SessionDep,
    import_id: uuid.UUID,
    body: VisionConfirmRequest,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
    storage: Annotated[Storage, Depends(get_storage)],
):
    """Archive the dataset (if opted in) and mark the import confirmed. The roster
    write happens on the frontend via the existing bulk endpoint — this route does
    not touch the roster."""
    vision_import = await _get_own_import(session, import_id, current_user.id)
    archived = await VisionImportService.confirm(session, storage, vision_import, body.rows)
    return VisionConfirmResponse(samples_archived=archived)


@vision_controller.get(
    "/imports/{import_id}/jobs/{job_id}/crops/{index}",
    response_model=PresignedUrlResponse,
)
async def get_crop_url(
    session: SessionDep,
    import_id: uuid.UUID,
    job_id: uuid.UUID,
    index: int,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
    storage: Annotated[Storage, Depends(get_storage)],
):
    """Short-lived presigned URL for one champion crop. The object key is rebuilt
    server-side from ids whose ownership is verified — a client-supplied key would
    let anyone read another user's screenshots by guessing."""
    await _get_own_import(session, import_id, current_user.id)
    key = crop_key(import_id, job_id, index)
    url = await storage.presign_get(
        SECRET.RUSTFS_BUCKET_VISION, key, SECRET.VISION_PRESIGN_EXPIRE_SECONDS
    )
    return PresignedUrlResponse(url=url)


@vision_controller.delete("/imports/{import_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_vision_import(
    session: SessionDep,
    import_id: uuid.UUID,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
    storage: Annotated[Storage, Depends(get_storage)],
):
    """Abandon an import. Queued jobs still in flight are ignored by the worker
    because their job row is gone (see the idempotency check in plan 2)."""
    vision_import = await _get_own_import(session, import_id, current_user.id)
    await VisionImportService.delete_import(session, storage, vision_import)


@vision_controller.post("/jobs/{job_id}/retry", status_code=status.HTTP_202_ACCEPTED)
async def retry_vision_job(
    session: SessionDep,
    job_id: uuid.UUID,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
    publisher: Annotated[VisionPublisher, Depends(get_publisher)],
):
    """Relaunch a screenshot the pipeline could not read.

    There is no automatic retry: a failed screenshot usually fails for a
    deterministic reason, and only the user knows whether the image was worth
    anything. This is that decision.
    """
    job = await session.get(VisionJob, job_id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=VISION_JOB_NOT_FOUND)
    # Reuses the plan-1 ownership chain: import -> game_account -> user.
    vision_import = await _get_own_import(session, job.import_id, current_user.id)
    if job.status != VisionJobStatus.FAILED:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=JOB_NOT_RETRYABLE)
    await VisionResultService.retry_job(session, publisher, job, vision_import)

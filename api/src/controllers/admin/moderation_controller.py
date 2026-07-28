import uuid

from fastapi import APIRouter, Depends, Query
from starlette import status

from src.dto.admin.dto_moderation import (
    MuteCreateRequest,
    MuteResponse,
    NoteRevisionResponse,
    PaginatedNoteReports,
    ReportResolveRequest,
    WarnCreateRequest,
    WarnResponse,
)
from src.enums.NoteReportStatus import NoteReportStatus
from src.services.admin.ModerationService import ModerationService
from src.services.auth.AuthService import AuthService
from src.utils.db import SessionDep

moderation_controller = APIRouter(
    prefix="/admin",
    tags=["Moderation"],
    dependencies=[Depends(AuthService.require_admin)],
)


@moderation_controller.get("/note-reports", response_model=PaginatedNoteReports)
async def list_note_reports(
    session: SessionDep,
    status_filter: NoteReportStatus | None = Query(default=None, alias="status"),
    alliance_id: uuid.UUID | None = None,
    page: int = 1,
    size: int = 20,
):
    return await ModerationService.list_reports(
        session, status=status_filter, alliance_id=alliance_id, page=page, size=size
    )


@moderation_controller.post("/note-reports/{report_id}/resolve", status_code=status.HTTP_200_OK)
async def resolve_note_report(
    report_id: uuid.UUID,
    body: ReportResolveRequest,
    session: SessionDep,
    current_user=Depends(AuthService.get_current_user_in_jwt),
):
    await ModerationService.resolve_report(
        session, report_id=report_id, admin_user_id=current_user.id, body=body
    )
    return {"ok": True}


@moderation_controller.get("/notes/{note_id}/revisions", response_model=list[NoteRevisionResponse])
async def get_note_revisions(note_id: uuid.UUID, session: SessionDep):
    return await ModerationService.get_revisions(session, note_id=note_id)


@moderation_controller.post("/users/{user_id}/mute", response_model=MuteResponse)
async def mute_user(
    user_id: uuid.UUID,
    body: MuteCreateRequest,
    session: SessionDep,
    current_user=Depends(AuthService.get_current_user_in_jwt),
):
    return await ModerationService.mute_user(
        session, user_id=user_id, admin_user_id=current_user.id, body=body
    )


@moderation_controller.delete("/users/{user_id}/mute", status_code=status.HTTP_200_OK)
async def lift_user_mute(
    user_id: uuid.UUID,
    session: SessionDep,
    current_user=Depends(AuthService.get_current_user_in_jwt),
):
    await ModerationService.lift_mute(session, user_id=user_id, admin_user_id=current_user.id)
    return {"ok": True}


@moderation_controller.post("/users/{user_id}/warn", response_model=WarnResponse)
async def warn_user(
    user_id: uuid.UUID,
    body: WarnCreateRequest,
    session: SessionDep,
    current_user=Depends(AuthService.get_current_user_in_jwt),
):
    return await ModerationService.warn_user(
        session, user_id=user_id, admin_user_id=current_user.id, body=body
    )


@moderation_controller.get("/mutes", response_model=list[MuteResponse])
async def list_mutes(session: SessionDep, active_only: bool = True):
    return await ModerationService.list_mutes(session, active_only=active_only)


@moderation_controller.get("/warns", response_model=list[WarnResponse])
async def list_warns(session: SessionDep, user_id: uuid.UUID | None = None):
    return await ModerationService.list_warns(session, user_id=user_id)

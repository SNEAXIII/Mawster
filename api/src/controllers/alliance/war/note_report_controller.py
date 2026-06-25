import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import select
from starlette import status

from src.dto.admin.dto_moderation import NoteReportCreateRequest, NoteReportResponse
from src.models import User
from src.models.GameAccount import GameAccount
from src.models.WarFightNote import WarFightNote
from src.services.admin.ModerationService import ModerationService
from src.services.alliance.AllianceService import AllianceService
from src.services.auth.AuthService import AuthService
from src.utils.db import SessionDep

note_report_controller = APIRouter(tags=["Moderation"])


@note_report_controller.post(
    "/notes/{note_id}/report",
    response_model=NoteReportResponse,
    status_code=status.HTTP_201_CREATED,
)
async def report_note(
    note_id: uuid.UUID,
    body: NoteReportCreateRequest,
    session: SessionDep,
    current_user: Annotated[User, Depends(AuthService.get_current_user_in_jwt)],
):
    """Report a war fight note. Any reader (member or visitor) of the alliance may report."""
    note = (await session.exec(select(WarFightNote).where(WarFightNote.id == note_id))).first()
    if note is None or note.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")

    await AllianceService.require_visitor(session, note.alliance_id, current_user.id)

    reporter_account = (
        await session.exec(
            select(GameAccount).where(
                GameAccount.user_id == current_user.id,
                GameAccount.alliance_id == note.alliance_id,
            )
        )
    ).first()
    account_id = reporter_account.id if reporter_account else None
    if account_id is None:
        any_account = (
            await session.exec(select(GameAccount).where(GameAccount.user_id == current_user.id))
        ).first()
        if any_account is None:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No game account")
        account_id = any_account.id

    report = await ModerationService.report_note(
        session,
        note_id=note_id,
        reporter_account_id=account_id,
        reporter_user_id=current_user.id,
        body=body,
    )
    return NoteReportResponse(
        id=report.id,
        note_id=note.id,
        alliance_id=note.alliance_id,
        battlegroup=note.battlegroup,
        node_number=note.node_number,
        note_content=note.content,
        reason=report.reason,
        status=report.status,
        created_at=report.created_at,
    )

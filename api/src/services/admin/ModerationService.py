import uuid
from datetime import datetime

from sqlmodel import and_, or_, select

from src.models.UserMute import UserMute
from src.utils.db import SessionDep


class ModerationService:
    @classmethod
    async def is_user_muted(cls, session: SessionDep, user_id: uuid.UUID) -> bool:
        now = datetime.now()
        mute = (
            await session.exec(
                select(UserMute).where(
                    and_(
                        UserMute.user_id == user_id,
                        UserMute.lifted_at.is_(None),
                        or_(UserMute.expires_at.is_(None), UserMute.expires_at > now),
                    )
                )
            )
        ).first()
        return mute is not None

    @classmethod
    async def report_note(cls, session, note_id, reporter_account_id, reporter_user_id, body):
        from fastapi import HTTPException
        from starlette import status

        from src.enums.NoteReportStatus import NoteReportStatus
        from src.models.NoteReport import NoteReport
        from src.models.WarFightNote import WarFightNote

        note = (await session.exec(select(WarFightNote).where(WarFightNote.id == note_id))).first()
        if note is None or note.deleted_at is not None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")

        if await cls.is_user_muted(session, reporter_user_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are muted and cannot report",
            )

        if note.whitelisted_at is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Note already reviewed; cannot report until it is edited",
            )

        existing = (
            await session.exec(
                select(NoteReport).where(
                    and_(
                        NoteReport.note_id == note_id,
                        NoteReport.reporter_game_account_id == reporter_account_id,
                        NoteReport.status == NoteReportStatus.pending,
                    )
                )
            )
        ).first()
        if existing is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="You already reported this note",
            )

        report = NoteReport(
            note_id=note_id,
            reporter_game_account_id=reporter_account_id,
            reason=body.reason,
            status=NoteReportStatus.pending,
        )
        session.add(report)
        await session.commit()
        await session.refresh(report)
        return report

    @classmethod
    async def pending_report_counts(cls, session, note_ids):
        """Return {note_id: pending_count} for the given note ids."""
        from sqlalchemy import func

        from src.enums.NoteReportStatus import NoteReportStatus
        from src.models.NoteReport import NoteReport

        if not note_ids:
            return {}
        rows = (
            await session.exec(
                select(NoteReport.note_id, func.count())
                .where(
                    and_(
                        NoteReport.note_id.in_(note_ids),
                        NoteReport.status == NoteReportStatus.pending,
                    )
                )
                .group_by(NoteReport.note_id)
            )
        ).all()
        return {nid: cnt for nid, cnt in rows}

import uuid
from datetime import datetime

from sqlmodel import and_, or_, select

from src.models.UserMute import UserMute
from src.utils.db import SessionDep

AUTO_BLOCK_THRESHOLD = 3


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
    async def resolve_report(cls, session, report_id, admin_user_id, body):
        from fastapi import HTTPException
        from starlette import status

        from src.enums.NoteReportStatus import NoteReportStatus
        from src.models.NoteReport import NoteReport
        from src.models.WarFightNote import WarFightNote

        report = (await session.exec(select(NoteReport).where(NoteReport.id == report_id))).first()
        if report is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
        note = (
            await session.exec(select(WarFightNote).where(WarFightNote.id == report.note_id))
        ).first()
        now = datetime.now()

        if body.action == "delete":
            note.deleted_at = now
            note.deleted_by_id = admin_user_id
            new_status = NoteReportStatus.resolved
        else:  # dismiss -> whitelist
            note.whitelisted_at = now
            note.whitelisted_by_id = admin_user_id
            new_status = NoteReportStatus.dismissed

        pending = (
            await session.exec(
                select(NoteReport).where(
                    and_(
                        NoteReport.note_id == note.id,
                        NoteReport.status == NoteReportStatus.pending,
                    )
                )
            )
        ).all()
        for r in pending:
            r.status = new_status
            r.resolved_by_id = admin_user_id
            r.resolved_at = now
            session.add(r)
        session.add(note)
        await session.commit()

    @classmethod
    async def mute_user(cls, session, user_id, admin_user_id, body):
        await cls.lift_mute(session, user_id=user_id, admin_user_id=admin_user_id, commit=False)
        mute = UserMute(
            user_id=user_id,
            reason=body.reason,
            muted_by_id=admin_user_id,
            expires_at=body.expires_at,
        )
        session.add(mute)
        await session.commit()
        await session.refresh(mute)
        return mute

    @classmethod
    async def lift_mute(cls, session, user_id, admin_user_id, commit=True):
        now = datetime.now()
        actives = (
            await session.exec(
                select(UserMute).where(
                    and_(
                        UserMute.user_id == user_id,
                        UserMute.lifted_at.is_(None),
                        or_(UserMute.expires_at.is_(None), UserMute.expires_at > now),
                    )
                )
            )
        ).all()
        for m in actives:
            m.lifted_at = now
            m.lifted_by_id = admin_user_id
            session.add(m)
        if commit:
            await session.commit()

    @classmethod
    async def warn_user(cls, session, user_id, admin_user_id, body):
        from src.models.UserWarn import UserWarn

        warn = UserWarn(user_id=user_id, reason=body.reason, warned_by_id=admin_user_id)
        session.add(warn)
        await session.commit()
        await session.refresh(warn)
        return warn

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

    @classmethod
    async def list_reports(cls, session, status=None, alliance_id=None, page=1, size=20):
        import math

        from sqlalchemy import func

        from src.dto.admin.dto_moderation import NoteReportResponse, PaginatedNoteReports
        from src.models.Alliance import Alliance
        from src.models.GameAccount import GameAccount
        from src.models.NoteReport import NoteReport
        from src.models.WarFightNote import WarFightNote

        conds = []
        if status is not None:
            conds.append(NoteReport.status == status)
        if alliance_id is not None:
            conds.append(WarFightNote.alliance_id == alliance_id)

        base = (
            select(NoteReport, WarFightNote, Alliance, GameAccount)
            .join(WarFightNote, NoteReport.note_id == WarFightNote.id)
            .join(Alliance, WarFightNote.alliance_id == Alliance.id)
            .join(GameAccount, NoteReport.reporter_game_account_id == GameAccount.id)
        )
        if conds:
            base = base.where(and_(*conds))

        total = (await session.exec(select(func.count()).select_from(base.subquery()))).one()
        rows = (
            await session.exec(
                base.order_by(NoteReport.created_at.desc()).offset((page - 1) * size).limit(size)
            )
        ).all()

        items = [
            NoteReportResponse(
                id=rep.id,
                note_id=note.id,
                alliance_id=note.alliance_id,
                alliance_name=alliance.name,
                battlegroup=note.battlegroup,
                node_number=note.node_number,
                note_content=note.content,
                reporter_pseudo=acc.game_pseudo,
                reason=rep.reason,
                status=rep.status,
                created_at=rep.created_at,
            )
            for rep, note, alliance, acc in rows
        ]
        return PaginatedNoteReports(
            items=items,
            total=total,
            page=page,
            size=size,
            pages=max(1, math.ceil(total / size)),
        )

    @classmethod
    async def get_revisions(cls, session, note_id):
        from src.dto.admin.dto_moderation import NoteRevisionResponse
        from src.models.GameAccount import GameAccount
        from src.models.WarFightNoteRevision import WarFightNoteRevision

        rows = (
            await session.exec(
                select(WarFightNoteRevision, GameAccount)
                .join(
                    GameAccount,
                    WarFightNoteRevision.edited_by_game_account_id == GameAccount.id,
                )
                .where(WarFightNoteRevision.note_id == note_id)
                .order_by(WarFightNoteRevision.edited_at.desc())
            )
        ).all()
        return [
            NoteRevisionResponse(
                id=rev.id,
                content=rev.content,
                edited_by_pseudo=acc.game_pseudo,
                edited_at=rev.edited_at,
            )
            for rev, acc in rows
        ]

    @classmethod
    async def list_mutes(cls, session, active_only=True):
        from src.dto.admin.dto_moderation import MuteResponse
        from src.models.User import User

        conds = []
        if active_only:
            now = datetime.now()
            conds += [
                UserMute.lifted_at.is_(None),
                or_(UserMute.expires_at.is_(None), UserMute.expires_at > now),
            ]
        stmt = select(UserMute, User).join(User, UserMute.user_id == User.id)
        if conds:
            stmt = stmt.where(and_(*conds))
        rows = (await session.exec(stmt.order_by(UserMute.created_at.desc()))).all()
        return [
            MuteResponse(
                id=m.id,
                user_id=m.user_id,
                user_login=u.login,
                reason=m.reason,
                created_at=m.created_at,
                expires_at=m.expires_at,
                lifted_at=m.lifted_at,
            )
            for m, u in rows
        ]

    @classmethod
    async def list_warns(cls, session, user_id=None):
        from src.dto.admin.dto_moderation import WarnResponse
        from src.models.User import User
        from src.models.UserWarn import UserWarn

        stmt = select(UserWarn, User).join(User, UserWarn.user_id == User.id)
        if user_id is not None:
            stmt = stmt.where(UserWarn.user_id == user_id)
        rows = (await session.exec(stmt.order_by(UserWarn.created_at.desc()))).all()
        return [
            WarnResponse(
                id=w.id,
                user_id=w.user_id,
                user_login=u.login,
                reason=w.reason,
                created_at=w.created_at,
            )
            for w, u in rows
        ]

    @classmethod
    async def get_active_mute(cls, session, user_id):
        now = datetime.now()
        return (
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

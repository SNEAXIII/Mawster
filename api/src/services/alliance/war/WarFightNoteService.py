import uuid

from fastapi import HTTPException
from sqlmodel import and_, select
from starlette import status

from src.dto.alliance.war.dto_war_note import WarFightNoteUpsertRequest
from src.models.Base import utcnow
from src.models.War import War, WarStatus
from src.models.WarDefensePlacement import WarDefensePlacement
from src.models.WarFightNote import WarFightNote
from src.models.WarFightNoteRevision import WarFightNoteRevision
from src.services.admin.ModerationService import ModerationService
from src.utils.db import SessionDep

WAR_ENDED_NOTE_LOCKED = HTTPException(
    status_code=status.HTTP_409_CONFLICT,
    detail="Cannot edit a note on a war that has ended",
)
NODE_HAS_NO_PLACEMENT = HTTPException(
    status_code=status.HTTP_404_NOT_FOUND,
    detail="No defender placement on this node",
)
USER_MUTED = HTTPException(
    status_code=status.HTTP_403_FORBIDDEN,
    detail="You are muted and cannot edit notes",
)
NOTE_CONTENT_UNCHANGED = HTTPException(
    status_code=status.HTTP_409_CONFLICT,
    detail="Note content is identical to the current one",
)
NOTE_NOT_FOUND = HTTPException(
    status_code=status.HTTP_404_NOT_FOUND,
    detail="No note on this node",
)


class WarFightNoteService:
    @classmethod
    async def upsert_note(
        cls,
        session: SessionDep,
        war: War,
        battlegroup: int,
        node_number: int,
        body: WarFightNoteUpsertRequest,
        editor_account_id: uuid.UUID,
        editor_user_id: uuid.UUID,
    ) -> WarFightNote:
        if await ModerationService.is_user_muted(session, editor_user_id):
            raise USER_MUTED

        if war.status == WarStatus.ended:
            raise WAR_ENDED_NOTE_LOCKED

        placement = (
            await session.exec(
                select(WarDefensePlacement).where(
                    and_(
                        WarDefensePlacement.war_id == war.id,
                        WarDefensePlacement.battlegroup == battlegroup,
                        WarDefensePlacement.node_number == node_number,
                    )
                )
            )
        ).first()
        if placement is None:
            raise NODE_HAS_NO_PLACEMENT

        note = (
            await session.exec(
                select(WarFightNote).where(
                    and_(
                        WarFightNote.war_id == war.id,
                        WarFightNote.battlegroup == battlegroup,
                        WarFightNote.node_number == node_number,
                    )
                )
            )
        ).first()

        now = utcnow()
        if note is None:
            note = WarFightNote(
                war_defense_placement_id=placement.id,
                war_id=war.id,
                alliance_id=war.alliance_id,
                battlegroup=battlegroup,
                node_number=node_number,
                content=body.content,
                created_by_game_account_id=editor_account_id,
                updated_by_game_account_id=editor_account_id,
                created_at=now,
                updated_at=now,
            )
            session.add(note)
            await session.flush()
        else:
            # Reject a no-op save: identical content on an active note (a deleted note may
            # still be reactivated with the same text).
            if note.deleted_at is None and note.content == body.content:
                raise NOTE_CONTENT_UNCHANGED
            note.content = body.content
            note.updated_by_game_account_id = editor_account_id
            note.updated_at = now
            session.add(note)
            # Editing a note no longer changes the state of its reports:
            # admins review the revision history and act manually.
            note.whitelisted_at = None
            note.whitelisted_by_id = None
            # A node only allows one note (unique constraint). If the previous one was
            # deleted by moderation, writing a new note reactivates the row so it is no
            # longer hidden — a deleted note must not mask the next one for that node.
            note.deleted_at = None
            note.deleted_by_id = None

        session.add(
            WarFightNoteRevision(
                note_id=note.id,
                content=body.content,
                edited_by_game_account_id=editor_account_id,
                edited_at=now,
            )
        )
        await session.commit()
        await session.refresh(note)
        return note

    @classmethod
    async def delete_note(
        cls,
        session: SessionDep,
        war: War,
        battlegroup: int,
        node_number: int,
        editor_user_id: uuid.UUID,
    ) -> None:
        """Soft-delete the active note on a node (officer/owner action). The note row is kept
        and a deletion snapshot is appended to the revision history so it stays auditable —
        same persistence path as an admin moderation deletion."""
        if await ModerationService.is_user_muted(session, editor_user_id):
            raise USER_MUTED

        if war.status == WarStatus.ended:
            raise WAR_ENDED_NOTE_LOCKED

        note = (
            await session.exec(
                select(WarFightNote).where(
                    and_(
                        WarFightNote.war_id == war.id,
                        WarFightNote.battlegroup == battlegroup,
                        WarFightNote.node_number == node_number,
                        WarFightNote.deleted_at.is_(None),
                    )
                )
            )
        ).first()
        if note is None:
            raise NOTE_NOT_FOUND

        now = utcnow()
        note.deleted_at = now
        note.deleted_by_id = editor_user_id
        session.add(note)
        session.add(
            WarFightNoteRevision(
                note_id=note.id,
                content=note.content,
                edited_by_user_id=editor_user_id,
                is_deletion=True,
                edited_at=now,
            )
        )
        await session.commit()

    @classmethod
    async def get_note_for_node(
        cls, session: SessionDep, war_id: uuid.UUID, battlegroup: int, node_number: int
    ) -> WarFightNote | None:
        return (
            await session.exec(
                select(WarFightNote).where(
                    and_(
                        WarFightNote.war_id == war_id,
                        WarFightNote.battlegroup == battlegroup,
                        WarFightNote.node_number == node_number,
                        WarFightNote.deleted_at.is_(None),
                    )
                )
            )
        ).first()

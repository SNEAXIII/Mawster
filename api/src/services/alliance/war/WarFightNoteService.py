import uuid
from datetime import datetime
from typing import Optional

from fastapi import HTTPException
from sqlmodel import and_, select
from starlette import status

from src.dto.alliance.war.dto_war_note import WarFightNoteUpsertRequest
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

        now = datetime.now()
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
            note.content = body.content
            note.updated_by_game_account_id = editor_account_id
            note.updated_at = now
            session.add(note)

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
    async def get_note_for_node(
        cls, session: SessionDep, war_id: uuid.UUID, battlegroup: int, node_number: int
    ) -> Optional[WarFightNote]:
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

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

import sqlalchemy as sa
from sqlmodel import Field, Relationship

from src.models.Base import FK_GAME_ACCOUNT, FK_USER, FK_WAR_FIGHT_NOTE, UUIDBase, utcnow

if TYPE_CHECKING:
    from src.models.war.WarFightNote import WarFightNote


class WarFightNoteRevision(UUIDBase, table=True):
    __tablename__ = "war_fight_note_revision"

    note_id: uuid.UUID = Field(foreign_key=FK_WAR_FIGHT_NOTE)
    content: str = Field(sa_column=sa.Column(sa.Text, nullable=False))
    edited_by_game_account_id: uuid.UUID | None = Field(default=None, foreign_key=FK_GAME_ACCOUNT)
    edited_by_user_id: uuid.UUID | None = Field(default=None, foreign_key=FK_USER)
    is_deletion: bool = Field(default=False)
    edited_at: datetime = Field(default_factory=utcnow)

    note: "WarFightNote" = Relationship(back_populates="revisions")

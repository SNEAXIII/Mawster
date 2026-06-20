import uuid
from datetime import datetime
from typing import TYPE_CHECKING

import sqlalchemy as sa
from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from src.models.WarFightNote import WarFightNote


class WarFightNoteRevision(SQLModel, table=True):
    """One row per note edit. Audit trail; admin-only (surfaced via report review later)."""

    __tablename__ = "war_fight_note_revision"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    note_id: uuid.UUID = Field(foreign_key="war_fight_note.id")
    content: str = Field(sa_column=sa.Column(sa.Text, nullable=False))
    edited_by_game_account_id: uuid.UUID = Field(foreign_key="game_account.id")
    edited_at: datetime = Field(default_factory=datetime.now)

    note: "WarFightNote" = Relationship(back_populates="revisions")

import uuid
from datetime import datetime
from typing import Optional, TYPE_CHECKING

import sqlalchemy as sa
from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from src.models.WarFightNote import WarFightNote


class WarFightNoteRevision(SQLModel, table=True):
    __tablename__ = "war_fight_note_revision"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    note_id: uuid.UUID = Field(foreign_key="war_fight_note.id")
    content: str = Field(sa_column=sa.Column(sa.Text, nullable=False))
    edited_by_game_account_id: Optional[uuid.UUID] = Field(
        default=None, foreign_key="game_account.id"
    )
    edited_by_user_id: Optional[uuid.UUID] = Field(default=None, foreign_key="user.id")
    is_deletion: bool = Field(default=False)
    edited_at: datetime = Field(default_factory=datetime.now)

    note: "WarFightNote" = Relationship(back_populates="revisions")

import uuid
from datetime import datetime
from typing import List, Optional, TYPE_CHECKING

import sqlalchemy as sa
from sqlmodel import Field, Relationship

from src.models.Base import TimestampMixin, UUIDBase, utcnow

if TYPE_CHECKING:
    from src.models.WarFightNoteRevision import WarFightNoteRevision


class WarFightNote(UUIDBase, TimestampMixin, table=True):
    """A note attached to one war combat node. Editable by officers/owners while the war is
    active; frozen (linked to the fight record) at snapshot."""

    __tablename__ = "war_fight_note"
    __table_args__ = (
        sa.UniqueConstraint("war_id", "battlegroup", "node_number", name="uq_war_fight_note_node"),
    )

    war_defense_placement_id: uuid.UUID = Field(foreign_key="war_defense_placement.id")
    war_id: uuid.UUID = Field(foreign_key="war.id")
    alliance_id: uuid.UUID = Field(foreign_key="alliance.id")
    battlegroup: int = Field(ge=1, le=3)
    node_number: int = Field(ge=1, le=50)
    content: str = Field(sa_column=sa.Column(sa.Text, nullable=False))
    created_by_game_account_id: uuid.UUID = Field(foreign_key="game_account.id")
    updated_by_game_account_id: uuid.UUID = Field(foreign_key="game_account.id")
    updated_at: datetime = Field(default_factory=utcnow)
    war_fight_record_id: Optional[uuid.UUID] = Field(
        default=None, foreign_key="war_fight_record.id"
    )
    # Moderation columns (used by a later plan; created now to avoid a second migration churn).
    whitelisted_at: Optional[datetime] = Field(default=None)
    whitelisted_by_id: Optional[uuid.UUID] = Field(default=None, foreign_key="user.id")
    deleted_at: Optional[datetime] = Field(default=None)
    deleted_by_id: Optional[uuid.UUID] = Field(default=None, foreign_key="user.id")

    revisions: List["WarFightNoteRevision"] = Relationship(back_populates="note")

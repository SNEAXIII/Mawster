import uuid
from datetime import datetime
from typing import TYPE_CHECKING

import sqlalchemy as sa
from sqlmodel import Field, Relationship

from src.models.Base import (
    FK_USER,
    FK_WAR_DEFENSE_PLACEMENT,
    FK_WAR_FIGHT_RECORD,
    AllianceFk,
    AuthorshipFk,
    SoftDelete,
    TimestampMixin,
    UUIDBase,
    WarCoords,
    WarFk,
    utcnow,
)

if TYPE_CHECKING:
    from src.models.war.WarFightNoteRevision import WarFightNoteRevision


class WarFightNote(
    UUIDBase, AuthorshipFk, AllianceFk, TimestampMixin, WarFk, WarCoords, SoftDelete, table=True
):
    """A note attached to one war combat node. Editable by officers/owners while the war is
    active; frozen (linked to the fight record) at snapshot."""

    __tablename__ = "war_fight_note"
    __table_args__ = (
        sa.UniqueConstraint("war_id", "battlegroup", "node_number", name="uq_war_fight_note_node"),
    )

    # Nullable + SET NULL: removing/replacing a defender must not destroy the node's note.
    # This column is provenance only (written once at creation, never read back), so losing
    # the link when the placement is deleted is safe; the note stays keyed on its node.
    war_defense_placement_id: uuid.UUID | None = Field(
        default=None, foreign_key=FK_WAR_DEFENSE_PLACEMENT, ondelete="SET NULL"
    )
    content: str = Field(sa_column=sa.Column(sa.Text, nullable=False))
    updated_at: datetime = Field(default_factory=utcnow)
    war_fight_record_id: uuid.UUID | None = Field(default=None, foreign_key=FK_WAR_FIGHT_RECORD)
    # Moderation columns (used by a later plan; created now to avoid a second migration churn).
    whitelisted_at: datetime | None = Field(default=None)
    whitelisted_by_id: uuid.UUID | None = Field(default=None, foreign_key=FK_USER)
    deleted_by_id: uuid.UUID | None = Field(default=None, foreign_key=FK_USER)

    revisions: list["WarFightNoteRevision"] = Relationship(back_populates="note")

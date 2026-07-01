import uuid
from datetime import datetime
from typing import TYPE_CHECKING
from sqlmodel import Field, Relationship

from src.models.Base import UUIDBase, utcnow

if TYPE_CHECKING:
    from src.models.Alliance import Alliance
    from src.models.GameAccount import GameAccount


class AllianceVisitor(UUIDBase, table=True):
    """A game account that is visiting an alliance as a read-only spectator."""

    __tablename__ = "alliance_visitor"

    alliance_id: uuid.UUID = Field(foreign_key="alliance.id")
    game_account_id: uuid.UUID = Field(foreign_key="game_account.id")
    visited_at: datetime = Field(default_factory=utcnow)

    # Relations
    alliance: "Alliance" = Relationship(back_populates="visitors")
    game_account: "GameAccount" = Relationship(back_populates="visited_alliances")

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlmodel import Field, Relationship

from src.models.Base import UUIDBase, utcnow

if TYPE_CHECKING:
    from src.models.Alliance import Alliance
    from src.models.GameAccount import GameAccount


class AllianceOfficer(UUIDBase, table=True):
    """Association table: a game account designated as officer (deputy) of an alliance."""

    __tablename__ = "alliance_officer"

    alliance_id: uuid.UUID = Field(foreign_key="alliance.id")
    game_account_id: uuid.UUID = Field(foreign_key="game_account.id")
    assigned_at: datetime = Field(default_factory=utcnow)

    # Relations
    alliance: "Alliance" = Relationship(back_populates="officers")
    game_account: "GameAccount" = Relationship(back_populates="officer_entries")

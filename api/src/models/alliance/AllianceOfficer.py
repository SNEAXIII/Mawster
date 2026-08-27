from datetime import datetime
from typing import TYPE_CHECKING

from sqlmodel import Field, Relationship

from src.models.Base import AllianceFk, GameAccountFk, UUIDBase, utcnow

if TYPE_CHECKING:
    from src.models.alliance.Alliance import Alliance
    from src.models.user.GameAccount import GameAccount


class AllianceOfficer(UUIDBase, AllianceFk, GameAccountFk, table=True):
    """Association table: a game account designated as officer (deputy) of an alliance."""

    __tablename__ = "alliance_officer"

    assigned_at: datetime = Field(default_factory=utcnow)

    # Relations
    alliance: "Alliance" = Relationship(back_populates="officers")
    game_account: "GameAccount" = Relationship(back_populates="officer_entries")

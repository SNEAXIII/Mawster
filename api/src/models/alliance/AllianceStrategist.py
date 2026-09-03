from datetime import datetime
from typing import TYPE_CHECKING

from sqlmodel import Field, Relationship

from src.models.Base import AllianceFk, GameAccountFk, UUIDBase, utcnow

if TYPE_CHECKING:
    from src.models.alliance.Alliance import Alliance
    from src.models.user.GameAccount import GameAccount


class AllianceStrategist(UUIDBase, AllianceFk, GameAccountFk, table=True):
    """Association table: a game account granted placement rights over an alliance.

    Ranks above a plain member and below an officer, and the two are exclusive:
    promoting a strategist to officer deletes this row.
    """

    __tablename__ = "alliance_strategist"

    assigned_at: datetime = Field(default_factory=utcnow)

    # Relations
    alliance: "Alliance" = Relationship(back_populates="strategists")
    game_account: "GameAccount" = Relationship(back_populates="strategist_entries")

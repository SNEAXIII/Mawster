import uuid
from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, Optional

from sqlmodel import Field, Relationship

from src.models.Base import TimestampMixin, UUIDBase


class WarStatus(str, Enum):
    active = "active"
    ended = "ended"


if TYPE_CHECKING:
    from src.models.Alliance import Alliance
    from src.models.GameAccount import GameAccount
    from src.models.Season import Season
    from src.models.WarBan import WarBan
    from src.models.WarDefensePlacement import WarDefensePlacement


class War(UUIDBase, TimestampMixin, table=True):
    __tablename__ = "war"

    alliance_id: uuid.UUID = Field(foreign_key="alliance.id")
    opponent_name: str = Field(max_length=100)
    status: WarStatus = Field(default=WarStatus.active)
    created_by_id: uuid.UUID = Field(foreign_key="game_account.id")
    season_id: uuid.UUID | None = Field(default=None, foreign_key="season.id")
    win: bool | None = Field(default=None)
    elo_change: int | None = Field(default=None)
    tier: int | None = Field(default=None)
    snapshotted_at: datetime | None = Field(default=None)

    # Relations
    alliance: "Alliance" = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[War.alliance_id]"},
    )
    created_by: "GameAccount" = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[War.created_by_id]"},
    )
    placements: list["WarDefensePlacement"] = Relationship(back_populates="war")
    bans: list["WarBan"] = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[WarBan.war_id]"},
    )
    season: Optional["Season"] = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[War.season_id]"},
    )

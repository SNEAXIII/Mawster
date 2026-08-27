import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlmodel import Field, Relationship

from src.enums.WarStatus import WarStatus
from src.models.Base import AllianceFk, SeasonFk, TimestampMixin, UUIDBase

if TYPE_CHECKING:
    from src.models.alliance.Alliance import Alliance
    from src.models.user.GameAccount import GameAccount
    from src.models.war.Season import Season
    from src.models.war.WarBan import WarBan
    from src.models.war.WarDefensePlacement import WarDefensePlacement


class War(UUIDBase, SeasonFk, AllianceFk, TimestampMixin, table=True):
    __tablename__ = "war"

    opponent_name: str = Field(max_length=100)
    status: WarStatus = Field(default=WarStatus.active)
    created_by_id: uuid.UUID = Field(foreign_key="game_account.id")
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

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlmodel import Field, Relationship

from src.models.Base import TimestampMixin, UUIDBase

if TYPE_CHECKING:
    from src.models.ChampionUser import ChampionUser
    from src.models.GameAccount import GameAccount


class RequestedUpgrade(UUIDBase, TimestampMixin, table=True):
    __tablename__ = "requested_upgrade"

    champion_user_id: uuid.UUID = Field(foreign_key="champion_user.id")
    requester_game_account_id: uuid.UUID = Field(foreign_key="game_account.id")
    requested_rarity: str = Field(max_length=10)  # e.g. "7r3"
    done_at: datetime | None = Field(default=None)

    # Relations
    champion_user: "ChampionUser" = Relationship(
        back_populates="upgrade_requests",
        sa_relationship_kwargs={"foreign_keys": "[RequestedUpgrade.champion_user_id]"},
    )
    requester: "GameAccount" = Relationship(
        back_populates="requested_upgrades",
        sa_relationship_kwargs={"foreign_keys": "[RequestedUpgrade.requester_game_account_id]"},
    )

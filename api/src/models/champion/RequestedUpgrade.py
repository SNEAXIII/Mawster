import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlmodel import Field, Relationship

from src.models.Base import FK_GAME_ACCOUNT, ChampionUserFk, TimestampMixin, UUIDBase

if TYPE_CHECKING:
    from src.models.champion.ChampionUser import ChampionUser
    from src.models.user.GameAccount import GameAccount


class RequestedUpgrade(UUIDBase, ChampionUserFk, TimestampMixin, table=True):
    __tablename__ = "requested_upgrade"

    requester_game_account_id: uuid.UUID = Field(foreign_key=FK_GAME_ACCOUNT)
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

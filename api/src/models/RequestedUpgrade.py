import uuid
from datetime import datetime
from typing import Optional, TYPE_CHECKING
from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from src.models.ChampionUser import ChampionUser
    from src.models.GameAccount import GameAccount


class RequestedUpgrade(SQLModel, table=True):
    __tablename__ = "requested_upgrade"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    champion_user_id: uuid.UUID = Field(foreign_key="champion_user.id")
    requester_game_account_id: uuid.UUID = Field(foreign_key="game_account.id")
    requested_rarity: str = Field(max_length=10)  # e.g. "7r3"
    created_at: datetime = Field(default_factory=datetime.now)
    done_at: Optional[datetime] = Field(default=None)

    # Relations
    champion_user: "ChampionUser" = Relationship(
        back_populates="upgrade_requests",
        sa_relationship_kwargs={"foreign_keys": "[RequestedUpgrade.champion_user_id]"},
    )
    requester: "GameAccount" = Relationship(
        back_populates="requested_upgrades",
        sa_relationship_kwargs={"foreign_keys": "[RequestedUpgrade.requester_game_account_id]"},
    )

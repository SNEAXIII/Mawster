import uuid
from datetime import datetime
from enum import Enum
from typing import List, TYPE_CHECKING
from sqlmodel import Field, Relationship, SQLModel


class WarStatus(str, Enum):
    active = "active"
    ended = "ended"

if TYPE_CHECKING:
    from src.models.Alliance import Alliance
    from src.models.GameAccount import GameAccount
    from src.models.WarDefensePlacement import WarDefensePlacement


class War(SQLModel, table=True):
    __tablename__ = "war"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    alliance_id: uuid.UUID = Field(foreign_key="alliance.id")
    opponent_name: str = Field(max_length=100)
    status: WarStatus = Field(default=WarStatus.active)
    created_by_id: uuid.UUID = Field(foreign_key="game_account.id")
    created_at: datetime = Field(default_factory=datetime.now)

    # Relations
    alliance: "Alliance" = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[War.alliance_id]"},
    )
    created_by: "GameAccount" = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[War.created_by_id]"},
    )
    placements: List["WarDefensePlacement"] = Relationship(back_populates="war")

import uuid
from datetime import datetime
from typing import Optional, TYPE_CHECKING
import sqlalchemy as sa
from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from src.models.Alliance import Alliance
    from src.models.GameAccount import GameAccount
    from src.models.ChampionUser import ChampionUser


class DefensePlacement(SQLModel, table=True):
    __tablename__ = "defense_placement"
    __table_args__ = (
        sa.UniqueConstraint("alliance_id", "battlegroup", "node_number", name="uq_defense_node"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    alliance_id: uuid.UUID = Field(foreign_key="alliance.id")
    battlegroup: int = Field(ge=1, le=3)
    node_number: int = Field(ge=1, le=55)
    champion_user_id: uuid.UUID = Field(foreign_key="champion_user.id")
    game_account_id: uuid.UUID = Field(foreign_key="game_account.id")
    placed_by_id: Optional[uuid.UUID] = Field(
        default=None, foreign_key="game_account.id"
    )
    created_at: datetime = Field(default_factory=datetime.now)

    # Relations
    alliance: "Alliance" = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[DefensePlacement.alliance_id]"},
    )
    champion_user: "ChampionUser" = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[DefensePlacement.champion_user_id]"},
    )
    game_account: "GameAccount" = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[DefensePlacement.game_account_id]"},
    )
    placed_by: Optional["GameAccount"] = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[DefensePlacement.placed_by_id]"},
    )

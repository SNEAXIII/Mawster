import uuid
from datetime import datetime
from typing import Optional, TYPE_CHECKING
import sqlalchemy as sa
from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from src.models.War import War
    from src.models.Champion import Champion
    from src.models.GameAccount import GameAccount
    from src.models.ChampionUser import ChampionUser


class WarDefensePlacement(SQLModel, table=True):
    __tablename__ = "war_defense_placement"
    __table_args__ = (
        sa.UniqueConstraint("war_id", "battlegroup", "node_number", name="uq_war_defense_node"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    war_id: uuid.UUID = Field(foreign_key="war.id")
    battlegroup: int = Field(ge=1, le=3)
    node_number: int = Field(ge=1, le=55)
    champion_id: uuid.UUID = Field(foreign_key="champion.id")
    stars: int = Field(ge=6, le=7)
    rank: int = Field(ge=1, le=5)
    ascension: int = Field(default=0, ge=0, le=2)
    placed_by_id: Optional[uuid.UUID] = Field(default=None, foreign_key="game_account.id")
    created_at: datetime = Field(default_factory=datetime.now)
    attacker_champion_user_id: Optional[uuid.UUID] = Field(
        default=None, foreign_key="champion_user.id"
    )
    ko_count: int = Field(default=0, ge=0)

    # Relations
    war: "War" = Relationship(back_populates="placements")
    champion: "Champion" = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[WarDefensePlacement.champion_id]"},
    )
    placed_by: Optional["GameAccount"] = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[WarDefensePlacement.placed_by_id]"},
    )
    attacker_champion_user: Optional["ChampionUser"] = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[WarDefensePlacement.attacker_champion_user_id]"},
    )

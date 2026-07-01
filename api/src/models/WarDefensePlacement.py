import uuid
from typing import Optional, TYPE_CHECKING
import sqlalchemy as sa
from sqlmodel import Field, Relationship

from src.models.Base import (
    Ascension,
    Battlegroup,
    KoCount,
    NodeNumber,
    Rank,
    Stars,
    TimestampMixin,
    UUIDBase,
)

if TYPE_CHECKING:
    from src.models.War import War
    from src.models.Champion import Champion
    from src.models.GameAccount import GameAccount
    from src.models.ChampionUser import ChampionUser


class WarDefensePlacement(UUIDBase, TimestampMixin, table=True):
    __tablename__ = "war_defense_placement"
    __table_args__ = (
        sa.UniqueConstraint("war_id", "battlegroup", "node_number", name="uq_war_defense_node"),
    )

    war_id: uuid.UUID = Field(foreign_key="war.id")
    battlegroup: Battlegroup
    node_number: NodeNumber
    champion_id: uuid.UUID = Field(foreign_key="champion.id")
    stars: Stars
    rank: Rank
    ascension: Ascension = 0
    placed_by_id: Optional[uuid.UUID] = Field(default=None, foreign_key="game_account.id")
    attacker_champion_user_id: Optional[uuid.UUID] = Field(
        default=None, foreign_key="champion_user.id"
    )
    assist_champion_user_id: Optional[uuid.UUID] = Field(
        default=None, foreign_key="champion_user.id"
    )
    ko_count: KoCount = 0
    is_combat_completed: bool = Field(default=False)
    is_fight_not_done: bool = Field(default=False)
    is_planning_error: bool = Field(default=False)

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
    assist_champion_user: Optional["ChampionUser"] = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[WarDefensePlacement.assist_champion_user_id]"},
    )

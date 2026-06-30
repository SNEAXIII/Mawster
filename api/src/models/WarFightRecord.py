import uuid
from typing import List, Optional, TYPE_CHECKING

from sqlmodel import Field, Relationship

from src.models.Base import Battlegroup, NodeNumber, TimestampMixin, UUIDBase

if TYPE_CHECKING:
    from src.models.Alliance import Alliance
    from src.models.Champion import Champion
    from src.models.GameAccount import GameAccount
    from src.models.Season import Season
    from src.models.War import War
    from src.models.WarFightPrefight import WarFightPrefight
    from src.models.WarFightSynergy import WarFightSynergy


class WarFightRecord(UUIDBase, TimestampMixin, table=True):
    __tablename__ = "war_fight_record"

    war_id: uuid.UUID = Field(foreign_key="war.id")
    alliance_id: uuid.UUID = Field(foreign_key="alliance.id")
    season_id: Optional[uuid.UUID] = Field(default=None, foreign_key="season.id")
    game_account_id: uuid.UUID = Field(foreign_key="game_account.id")
    battlegroup: Battlegroup
    node_number: NodeNumber
    tier: int
    champion_id: uuid.UUID = Field(foreign_key="champion.id")
    stars: int
    rank: int
    ascension: int
    is_saga_attacker: bool
    defender_champion_id: uuid.UUID = Field(foreign_key="champion.id")
    defender_stars: int
    defender_rank: int
    defender_ascension: int
    defender_is_saga_defender: bool
    ko_count: int = Field(default=0)
    is_planning_error: bool = Field(default=False)
    assisted: bool = Field(default=False)

    war: "War" = Relationship(sa_relationship_kwargs={"foreign_keys": "[WarFightRecord.war_id]"})
    alliance: "Alliance" = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[WarFightRecord.alliance_id]"}
    )
    season: Optional["Season"] = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[WarFightRecord.season_id]"}
    )
    game_account: "GameAccount" = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[WarFightRecord.game_account_id]"}
    )
    champion: "Champion" = Relationship(
        sa_relationship_kwargs={
            "foreign_keys": "[WarFightRecord.champion_id]",
            "overlaps": "defender_champion",
        }
    )
    defender_champion: "Champion" = Relationship(
        sa_relationship_kwargs={
            "foreign_keys": "[WarFightRecord.defender_champion_id]",
            "overlaps": "champion",
        }
    )
    synergies: List["WarFightSynergy"] = Relationship(back_populates="fight_record")
    prefights: List["WarFightPrefight"] = Relationship(back_populates="fight_record")

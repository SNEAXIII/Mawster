import uuid
from typing import Optional, TYPE_CHECKING

from sqlmodel import Field, Relationship

from src.models.Base import KoCount, NodeNumber, TimestampMixin, UUIDBase

if TYPE_CHECKING:
    from src.models.Alliance import Alliance
    from src.models.Champion import Champion
    from src.models.GameAccount import GameAccount
    from src.models.Season import Season


class WarFightRecordImport(UUIDBase, TimestampMixin, table=True):
    __tablename__ = "war_fight_record_import"

    alliance_id: uuid.UUID = Field(foreign_key="alliance.id")
    season_id: Optional[uuid.UUID] = Field(default=None, foreign_key="season.id")
    node_number: NodeNumber
    champion_id: uuid.UUID = Field(foreign_key="champion.id")
    defender_champion_id: uuid.UUID = Field(foreign_key="champion.id")
    ko_count: KoCount = 0
    imported_by_id: uuid.UUID = Field(foreign_key="game_account.id")

    alliance: "Alliance" = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[WarFightRecordImport.alliance_id]"}
    )
    season: Optional["Season"] = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[WarFightRecordImport.season_id]"}
    )
    champion: "Champion" = Relationship(
        sa_relationship_kwargs={
            "foreign_keys": "[WarFightRecordImport.champion_id]",
            "overlaps": "defender_champion",
        }
    )
    defender_champion: "Champion" = Relationship(
        sa_relationship_kwargs={
            "foreign_keys": "[WarFightRecordImport.defender_champion_id]",
            "overlaps": "champion",
        }
    )
    imported_by: "GameAccount" = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[WarFightRecordImport.imported_by_id]"}
    )

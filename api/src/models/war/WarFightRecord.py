import uuid
from typing import TYPE_CHECKING, Optional

from sqlmodel import Field, Relationship

from src.models.Base import (
    FK_WAR,
    AllianceFk,
    Ascension,
    Battlegroup,
    ChampionFk,
    DefenderChampionFk,
    GameAccountFk,
    KoCount,
    NodeNumber,
    Rank,
    SeasonFk,
    Stars,
    TimestampMixin,
    UUIDBase,
)

if TYPE_CHECKING:
    from src.models.alliance.Alliance import Alliance
    from src.models.champion.Champion import Champion
    from src.models.user.GameAccount import GameAccount
    from src.models.war.Season import Season
    from src.models.war.War import War
    from src.models.war.WarFightPrefight import WarFightPrefight
    from src.models.war.WarFightSynergy import WarFightSynergy


class WarFightRecord(
    UUIDBase,
    DefenderChampionFk,
    SeasonFk,
    AllianceFk,
    ChampionFk,
    TimestampMixin,
    GameAccountFk,
    table=True,
):
    __tablename__ = "war_fight_record"

    war_id: uuid.UUID = Field(foreign_key=FK_WAR)
    battlegroup: Battlegroup
    node_number: NodeNumber
    tier: int
    stars: Stars
    rank: Rank
    ascension: Ascension
    is_saga_attacker: bool
    defender_stars: int
    defender_rank: int
    defender_ascension: int
    defender_is_saga_defender: bool
    ko_count: KoCount = 0
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
    synergies: list["WarFightSynergy"] = Relationship(back_populates="fight_record")
    prefights: list["WarFightPrefight"] = Relationship(back_populates="fight_record")

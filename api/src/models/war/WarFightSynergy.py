from typing import TYPE_CHECKING

from sqlmodel import Relationship

from src.models.Base import Ascension, ChampionFk, Stars, UUIDBase, WarFightRecordFk

if TYPE_CHECKING:
    from src.models.champion.Champion import Champion
    from src.models.war.WarFightRecord import WarFightRecord


class WarFightSynergy(UUIDBase, WarFightRecordFk, ChampionFk, table=True):
    __tablename__ = "war_fight_synergy"

    stars: Stars
    ascension: Ascension

    fight_record: "WarFightRecord" = Relationship(
        back_populates="synergies",
        sa_relationship_kwargs={"foreign_keys": "[WarFightSynergy.war_fight_record_id]"},
    )
    champion: "Champion" = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[WarFightSynergy.champion_id]"}
    )

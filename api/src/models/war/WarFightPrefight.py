from typing import TYPE_CHECKING

from sqlmodel import Relationship

from src.models.Base import Ascension, ChampionFk, Stars, UUIDBase, WarFightRecordFk

if TYPE_CHECKING:
    from src.models.champion.Champion import Champion
    from src.models.war.WarFightRecord import WarFightRecord


class WarFightPrefight(UUIDBase, WarFightRecordFk, ChampionFk, table=True):
    __tablename__ = "war_fight_prefight"

    stars: Stars
    ascension: Ascension

    fight_record: "WarFightRecord" = Relationship(
        back_populates="prefights",
        sa_relationship_kwargs={"foreign_keys": "[WarFightPrefight.war_fight_record_id]"},
    )
    champion: "Champion" = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[WarFightPrefight.champion_id]"}
    )

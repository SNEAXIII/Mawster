import uuid
from typing import TYPE_CHECKING

from sqlmodel import Field, Relationship

from src.models.Base import Ascension, ChampionFk, Stars, UUIDBase

if TYPE_CHECKING:
    from src.models.champion.Champion import Champion
    from src.models.war.WarFightRecord import WarFightRecord


class WarFightPrefight(UUIDBase, ChampionFk, table=True):
    __tablename__ = "war_fight_prefight"

    war_fight_record_id: uuid.UUID = Field(foreign_key="war_fight_record.id")
    stars: Stars
    ascension: Ascension

    fight_record: "WarFightRecord" = Relationship(
        back_populates="prefights",
        sa_relationship_kwargs={"foreign_keys": "[WarFightPrefight.war_fight_record_id]"},
    )
    champion: "Champion" = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[WarFightPrefight.champion_id]"}
    )

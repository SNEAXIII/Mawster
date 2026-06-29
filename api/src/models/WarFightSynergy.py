import uuid
from typing import TYPE_CHECKING

from sqlmodel import Field, Relationship

from src.models.Base import UUIDBase

if TYPE_CHECKING:
    from src.models.Champion import Champion
    from src.models.WarFightRecord import WarFightRecord


class WarFightSynergy(UUIDBase, table=True):
    __tablename__ = "war_fight_synergy"

    war_fight_record_id: uuid.UUID = Field(foreign_key="war_fight_record.id")
    champion_id: uuid.UUID = Field(foreign_key="champion.id")
    stars: int
    ascension: int

    fight_record: "WarFightRecord" = Relationship(
        back_populates="synergies",
        sa_relationship_kwargs={"foreign_keys": "[WarFightSynergy.war_fight_record_id]"},
    )
    champion: "Champion" = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[WarFightSynergy.champion_id]"}
    )

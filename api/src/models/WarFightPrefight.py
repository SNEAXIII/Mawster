import uuid
from typing import TYPE_CHECKING

from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from src.models.Champion import Champion
    from src.models.WarFightRecord import WarFightRecord


class WarFightPrefight(SQLModel, table=True):
    __tablename__ = "war_fight_prefight"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    war_fight_record_id: uuid.UUID = Field(foreign_key="war_fight_record.id")
    champion_id: uuid.UUID = Field(foreign_key="champion.id")
    stars: int
    ascension: int

    fight_record: "WarFightRecord" = Relationship(
        back_populates="prefights",
        sa_relationship_kwargs={"foreign_keys": "[WarFightPrefight.war_fight_record_id]"},
    )
    champion: "Champion" = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[WarFightPrefight.champion_id]"}
    )

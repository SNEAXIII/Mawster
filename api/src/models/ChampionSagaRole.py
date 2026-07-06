import uuid
from typing import TYPE_CHECKING, Optional

from sqlmodel import Field, Relationship, UniqueConstraint

from src.models.Base import UUIDBase

if TYPE_CHECKING:
    from src.models.Champion import Champion
    from src.models.Season import Season


class ChampionSagaRole(UUIDBase, table=True):
    __tablename__ = "champion_saga_role"
    __table_args__ = (UniqueConstraint("season_id", "champion_id", name="uq_saga_season_champion"),)

    season_id: uuid.UUID = Field(foreign_key="season.id", index=True, ondelete="CASCADE")
    champion_id: uuid.UUID = Field(foreign_key="champion.id", index=True, ondelete="CASCADE")
    is_saga_attacker: bool = Field(default=False)
    is_saga_defender: bool = Field(default=False)

    champion: Optional["Champion"] = Relationship(back_populates="saga_roles")
    season: Optional["Season"] = Relationship(back_populates="saga_roles")

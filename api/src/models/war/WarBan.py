import uuid
from typing import TYPE_CHECKING

import sqlalchemy as sa
from sqlmodel import Field, Relationship

from src.models.Base import ChampionFk, UUIDBase

if TYPE_CHECKING:
    from src.models.champion.Champion import Champion


class WarBan(UUIDBase, ChampionFk, table=True):
    __tablename__ = "war_ban"
    __table_args__ = (sa.UniqueConstraint("war_id", "champion_id", name="uq_war_ban_champion"),)

    war_id: uuid.UUID = Field(foreign_key="war.id", index=True)

    # Relations
    champion: "Champion" = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[WarBan.champion_id]"},
    )

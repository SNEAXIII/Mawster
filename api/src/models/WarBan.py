import uuid
from typing import TYPE_CHECKING

import sqlalchemy as sa
from sqlmodel import Field, Relationship

from src.models.Base import UUIDBase

if TYPE_CHECKING:
    from src.models.Champion import Champion


class WarBan(UUIDBase, table=True):
    __tablename__ = "war_ban"
    __table_args__ = (sa.UniqueConstraint("war_id", "champion_id", name="uq_war_ban_champion"),)

    war_id: uuid.UUID = Field(foreign_key="war.id", index=True)
    champion_id: uuid.UUID = Field(foreign_key="champion.id")

    # Relations
    champion: "Champion" = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[WarBan.champion_id]"},
    )

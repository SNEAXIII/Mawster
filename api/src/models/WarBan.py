import uuid
from typing import TYPE_CHECKING

import sqlalchemy as sa
from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from src.models.Champion import Champion


class WarBan(SQLModel, table=True):
    __tablename__ = "war_ban"
    __table_args__ = (
        sa.UniqueConstraint("war_id", "champion_id", name="uq_war_ban_champion"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    war_id: uuid.UUID = Field(foreign_key="war.id", index=True)
    champion_id: uuid.UUID = Field(foreign_key="champion.id")

    # Relations
    champion: "Champion" = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[WarBan.champion_id]"},
    )

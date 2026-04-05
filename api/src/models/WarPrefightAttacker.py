import uuid
from datetime import datetime
from typing import TYPE_CHECKING

import sqlalchemy as sa
from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from src.models.ChampionUser import ChampionUser
    from src.models.GameAccount import GameAccount
    from src.models.War import War


class WarPrefightAttacker(SQLModel, table=True):
    __tablename__ = "war_prefight_attacker"
    __table_args__ = (
        sa.UniqueConstraint(
            "war_id", "battlegroup", "champion_user_id",
            name="uq_war_prefight_champion",
        ),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    war_id: uuid.UUID = Field(foreign_key="war.id")
    battlegroup: int = Field(ge=1, le=3)
    game_account_id: uuid.UUID = Field(foreign_key="game_account.id")
    champion_user_id: uuid.UUID = Field(foreign_key="champion_user.id")
    target_node_number: int = Field(ge=1, le=55)
    created_at: datetime = Field(default_factory=datetime.now)

    # Relations
    war: "War" = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[WarPrefightAttacker.war_id]"},
    )
    game_account: "GameAccount" = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[WarPrefightAttacker.game_account_id]"},
    )
    champion_user: "ChampionUser" = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[WarPrefightAttacker.champion_user_id]"},
    )

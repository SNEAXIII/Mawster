import uuid
from typing import TYPE_CHECKING

import sqlalchemy as sa
from sqlmodel import Field, Relationship

from src.models.Base import TimestampMixin, UUIDBase

if TYPE_CHECKING:
    from src.models.ChampionUser import ChampionUser
    from src.models.GameAccount import GameAccount
    from src.models.War import War


class WarSynergyAttacker(UUIDBase, TimestampMixin, table=True):
    __tablename__ = "war_synergy_attacker"
    __table_args__ = (
        sa.UniqueConstraint(
            "war_id",
            "battlegroup",
            "champion_user_id",
            name="uq_war_synergy_champion",
        ),
    )

    war_id: uuid.UUID = Field(foreign_key="war.id")
    battlegroup: int = Field(ge=1, le=3)
    game_account_id: uuid.UUID = Field(foreign_key="game_account.id")
    champion_user_id: uuid.UUID = Field(foreign_key="champion_user.id")
    target_champion_user_id: uuid.UUID = Field(foreign_key="champion_user.id")

    # Relations
    war: "War" = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[WarSynergyAttacker.war_id]"},
    )
    game_account: "GameAccount" = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[WarSynergyAttacker.game_account_id]"},
    )
    champion_user: "ChampionUser" = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[WarSynergyAttacker.champion_user_id]"},
    )
    target_champion_user: "ChampionUser" = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[WarSynergyAttacker.target_champion_user_id]"},
    )

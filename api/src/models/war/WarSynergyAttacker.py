import uuid
from typing import TYPE_CHECKING, Optional

import sqlalchemy as sa
from sqlmodel import Field, Relationship

from src.models.Base import (
    FK_CHAMPION_USER,
    Battlegroup,
    ChampionFk,
    GameAccountFk,
    TimestampMixin,
    UUIDBase,
    WarFk,
)

if TYPE_CHECKING:
    from src.models.champion.Champion import Champion
    from src.models.champion.ChampionUser import ChampionUser
    from src.models.user.GameAccount import GameAccount
    from src.models.war.War import War


class WarSynergyAttacker(UUIDBase, ChampionFk, TimestampMixin, GameAccountFk, WarFk, table=True):
    __tablename__ = "war_synergy_attacker"
    __table_args__ = (
        sa.UniqueConstraint(
            "war_id",
            "battlegroup",
            "game_account_id",
            "champion_id",
            name="uq_war_synergy_champion",
        ),
    )

    battlegroup: Battlegroup
    # Null is an Unrecorded Copy: the player owns the champion off-site.
    champion_user_id: uuid.UUID | None = Field(default=None, foreign_key=FK_CHAMPION_USER)
    target_champion_user_id: uuid.UUID = Field(foreign_key=FK_CHAMPION_USER)

    # Relations
    war: "War" = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[WarSynergyAttacker.war_id]"},
    )
    game_account: "GameAccount" = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[WarSynergyAttacker.game_account_id]"},
    )
    champion: "Champion" = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[WarSynergyAttacker.champion_id]"},
    )
    champion_user: Optional["ChampionUser"] = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[WarSynergyAttacker.champion_user_id]"},
    )
    target_champion_user: "ChampionUser" = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[WarSynergyAttacker.target_champion_user_id]"},
    )

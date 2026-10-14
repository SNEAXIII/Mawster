import uuid
from typing import TYPE_CHECKING, Optional

import sqlalchemy as sa
from sqlmodel import Field, Relationship

from src.models.Base import (
    FK_CHAMPION_USER,
    Battlegroup,
    ChampionFk,
    GameAccountFk,
    NodeNumber,
    TimestampMixin,
    UUIDBase,
    WarFk,
)

if TYPE_CHECKING:
    from src.models.champion.Champion import Champion
    from src.models.champion.ChampionUser import ChampionUser
    from src.models.user.GameAccount import GameAccount
    from src.models.war.War import War


class WarPrefightAttacker(UUIDBase, ChampionFk, TimestampMixin, GameAccountFk, WarFk, table=True):
    __tablename__ = "war_prefight_attacker"
    __table_args__ = (
        sa.UniqueConstraint(
            "war_id",
            "battlegroup",
            "game_account_id",
            "champion_id",
            "target_node_number",
            name="uq_war_prefight_champion_node",
        ),
    )

    battlegroup: Battlegroup
    # Null is an Unrecorded Copy: the player owns the champion off-site.
    champion_user_id: uuid.UUID | None = Field(default=None, foreign_key=FK_CHAMPION_USER)
    target_node_number: NodeNumber

    # Relations
    war: "War" = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[WarPrefightAttacker.war_id]"},
    )
    game_account: "GameAccount" = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[WarPrefightAttacker.game_account_id]"},
    )
    champion: "Champion" = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[WarPrefightAttacker.champion_id]"},
    )
    champion_user: Optional["ChampionUser"] = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[WarPrefightAttacker.champion_user_id]"},
    )

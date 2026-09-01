import uuid
from typing import TYPE_CHECKING

import sqlalchemy as sa
from sqlmodel import Field, Relationship

from src.models.Base import (
    FK_WAR,
    Battlegroup,
    ChampionUserFk,
    GameAccountFk,
    NodeNumber,
    TimestampMixin,
    UUIDBase,
)

if TYPE_CHECKING:
    from src.models.champion.ChampionUser import ChampionUser
    from src.models.user.GameAccount import GameAccount
    from src.models.war.War import War


class WarPrefightAttacker(UUIDBase, ChampionUserFk, TimestampMixin, GameAccountFk, table=True):
    __tablename__ = "war_prefight_attacker"
    __table_args__ = (
        sa.UniqueConstraint(
            "war_id",
            "battlegroup",
            "champion_user_id",
            "target_node_number",
            name="uq_war_prefight_champion_node",
        ),
    )

    war_id: uuid.UUID = Field(foreign_key=FK_WAR)
    battlegroup: Battlegroup
    target_node_number: NodeNumber

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

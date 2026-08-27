from typing import TYPE_CHECKING, Optional

import sqlalchemy as sa
from sqlmodel import Relationship

from src.models.Base import (
    AllianceFk,
    Battlegroup,
    ChampionUserFk,
    GameAccountFk,
    NodeNumber,
    PlacedByFk,
    TimestampMixin,
    UUIDBase,
)

if TYPE_CHECKING:
    from src.models.alliance.Alliance import Alliance
    from src.models.champion.ChampionUser import ChampionUser
    from src.models.user.GameAccount import GameAccount


class DefensePlacement(
    UUIDBase,
    ChampionUserFk,
    PlacedByFk,
    AllianceFk,
    GameAccountFk,
    TimestampMixin,
    table=True,
):
    __tablename__ = "defense_placement"
    __table_args__ = (
        sa.UniqueConstraint("alliance_id", "battlegroup", "node_number", name="uq_defense_node"),
    )

    battlegroup: Battlegroup
    node_number: NodeNumber

    # Relations
    alliance: "Alliance" = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[DefensePlacement.alliance_id]"},
    )
    champion_user: "ChampionUser" = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[DefensePlacement.champion_user_id]"},
    )
    game_account: "GameAccount" = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[DefensePlacement.game_account_id]"},
    )
    placed_by: Optional["GameAccount"] = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[DefensePlacement.placed_by_id]"},
    )

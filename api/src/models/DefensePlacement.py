import uuid
from typing import TYPE_CHECKING, Optional

import sqlalchemy as sa
from sqlmodel import Field, Relationship

from src.models.Base import Battlegroup, NodeNumber, TimestampMixin, UUIDBase

if TYPE_CHECKING:
    from src.models.Alliance import Alliance
    from src.models.ChampionUser import ChampionUser
    from src.models.GameAccount import GameAccount


class DefensePlacement(UUIDBase, TimestampMixin, table=True):
    __tablename__ = "defense_placement"
    __table_args__ = (
        sa.UniqueConstraint("alliance_id", "battlegroup", "node_number", name="uq_defense_node"),
    )

    alliance_id: uuid.UUID = Field(foreign_key="alliance.id")
    battlegroup: Battlegroup
    node_number: NodeNumber
    champion_user_id: uuid.UUID = Field(foreign_key="champion_user.id")
    game_account_id: uuid.UUID = Field(foreign_key="game_account.id")
    placed_by_id: uuid.UUID | None = Field(default=None, foreign_key="game_account.id")

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

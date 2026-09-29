import uuid
from typing import TYPE_CHECKING, Optional

import sqlalchemy as sa
from sqlmodel import Field, Relationship

from src.enums.SeasonFormat import SeasonFormat
from src.game_types import DEFENSE_NAME_MAX_LENGTH
from src.models.Base import (
    FK_CHAMPION,
    FK_CHAMPION_USER,
    FK_DEFENSE_PLAN,
    FK_DEFENSE_TEMPLATE,
    AllianceFk,
    Battlegroup,
    NodeNumber,
    PlacedByFk,
    TimestampMixin,
    UUIDBase,
)

if TYPE_CHECKING:
    from src.models.champion.Champion import Champion
    from src.models.champion.ChampionUser import ChampionUser
    from src.models.user.GameAccount import GameAccount


class DefensePlan(UUIDBase, AllianceFk, TimestampMixin, table=True):
    __tablename__ = "defense_plan"
    __table_args__ = (
        sa.UniqueConstraint(
            "alliance_id", "battlegroup", "format", "name", name="uq_defense_plan_name"
        ),
    )

    battlegroup: Battlegroup
    format: SeasonFormat
    name: str = Field(max_length=DEFENSE_NAME_MAX_LENGTH)
    source_template_id: uuid.UUID | None = Field(
        default=None, foreign_key=FK_DEFENSE_TEMPLATE, ondelete="SET NULL"
    )

    nodes: list["DefensePlanNode"] = Relationship(
        back_populates="plan",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )


class DefensePlanNode(UUIDBase, PlacedByFk, table=True):
    __tablename__ = "defense_plan_node"
    __table_args__ = (
        sa.UniqueConstraint("plan_id", "node_number", name="uq_defense_plan_node"),
        sa.UniqueConstraint("plan_id", "champion_id", name="uq_defense_plan_champion"),
    )

    plan_id: uuid.UUID = Field(foreign_key=FK_DEFENSE_PLAN, ondelete="CASCADE")
    node_number: NodeNumber
    champion_id: uuid.UUID = Field(foreign_key=FK_CHAMPION, ondelete="CASCADE")
    champion_user_id: uuid.UUID | None = Field(
        default=None, foreign_key=FK_CHAMPION_USER, ondelete="SET NULL"
    )

    plan: DefensePlan = Relationship(back_populates="nodes")
    champion: "Champion" = Relationship()
    champion_user: Optional["ChampionUser"] = Relationship()
    placed_by: Optional["GameAccount"] = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[DefensePlanNode.placed_by_id]"},
    )


class DefenseActivePlan(UUIDBase, AllianceFk, table=True):
    """Which plan is in use; the unique key is what keeps it one per Battlegroup and format."""

    __tablename__ = "defense_active_plan"
    __table_args__ = (
        sa.UniqueConstraint("alliance_id", "battlegroup", "format", name="uq_defense_active_plan"),
    )

    battlegroup: Battlegroup
    format: SeasonFormat
    plan_id: uuid.UUID = Field(foreign_key=FK_DEFENSE_PLAN, ondelete="CASCADE", unique=True)

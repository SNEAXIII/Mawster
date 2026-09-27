import uuid
from typing import TYPE_CHECKING

import sqlalchemy as sa
from sqlmodel import Field, Relationship

from src.enums.SeasonFormat import SeasonFormat
from src.game_types import DEFENSE_NAME_MAX_LENGTH
from src.models.Base import (
    FK_CHAMPION,
    FK_DEFENSE_TEMPLATE,
    AllianceFk,
    NodeNumber,
    TimestampMixin,
    UUIDBase,
)

if TYPE_CHECKING:
    from src.models.champion.Champion import Champion


class DefenseTemplate(UUIDBase, AllianceFk, TimestampMixin, table=True):
    __tablename__ = "defense_template"
    __table_args__ = (
        sa.UniqueConstraint("alliance_id", "format", "name", name="uq_defense_template_name"),
    )

    format: SeasonFormat
    name: str = Field(max_length=DEFENSE_NAME_MAX_LENGTH)

    nodes: list["DefenseTemplateNode"] = Relationship(
        back_populates="template",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )


class DefenseTemplateNode(UUIDBase, table=True):
    __tablename__ = "defense_template_node"
    __table_args__ = (
        sa.UniqueConstraint("template_id", "node_number", name="uq_defense_template_node"),
        sa.UniqueConstraint("template_id", "champion_id", name="uq_defense_template_champion"),
    )

    template_id: uuid.UUID = Field(foreign_key=FK_DEFENSE_TEMPLATE, ondelete="CASCADE")
    node_number: NodeNumber
    champion_id: uuid.UUID = Field(foreign_key=FK_CHAMPION, ondelete="CASCADE")

    template: DefenseTemplate = Relationship(back_populates="nodes")
    champion: "Champion" = Relationship()

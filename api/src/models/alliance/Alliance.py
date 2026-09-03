import uuid
from typing import TYPE_CHECKING

import sqlalchemy as sa
from sqlmodel import Field, Relationship

from src.models.Base import (
    SoftDelete,
    Tier,
    TimestampMixin,
    UUIDBase,
)

if TYPE_CHECKING:
    from src.models.alliance.AllianceInvitation import AllianceInvitation
    from src.models.alliance.AllianceOfficer import AllianceOfficer
    from src.models.alliance.AllianceStrategist import AllianceStrategist
    from src.models.alliance.AllianceVisitor import AllianceVisitor
    from src.models.user.GameAccount import GameAccount


class Alliance(UUIDBase, TimestampMixin, SoftDelete, table=True):
    __tablename__ = "alliance"

    name: str = Field(max_length=50)
    tag: str = Field(max_length=5)
    owner_id: uuid.UUID = Field(
        sa_column=sa.Column(
            sa.Uuid(),
            sa.ForeignKey("game_account.id", use_alter=True),
            nullable=False,
        )
    )
    elo: int = Field(default=0)
    tier: Tier = 20
    # Soft delete: a disbanded alliance keeps its rows (wars, placements, stats)
    # so past seasons stay readable — same contract as User.deleted_at.

    # Relations
    owner: "GameAccount" = Relationship(
        back_populates="owned_alliance",
        sa_relationship_kwargs={"foreign_keys": "[Alliance.owner_id]"},
    )
    members: list["GameAccount"] = Relationship(
        back_populates="alliance",
        sa_relationship_kwargs={"foreign_keys": "[GameAccount.alliance_id]"},
    )
    officers: list["AllianceOfficer"] = Relationship(back_populates="alliance")
    strategists: list["AllianceStrategist"] = Relationship(back_populates="alliance")
    invitations: list["AllianceInvitation"] = Relationship(
        back_populates="alliance",
        sa_relationship_kwargs={"foreign_keys": "[AllianceInvitation.alliance_id]"},
    )
    visitors: list["AllianceVisitor"] = Relationship(back_populates="alliance")

import uuid
from typing import TYPE_CHECKING

import sqlalchemy as sa
from sqlmodel import Field, Relationship

from src.models.Base import TimestampMixin, UUIDBase

if TYPE_CHECKING:
    from src.models.AllianceInvitation import AllianceInvitation
    from src.models.AllianceOfficer import AllianceOfficer
    from src.models.AllianceVisitor import AllianceVisitor
    from src.models.GameAccount import GameAccount


class Alliance(UUIDBase, TimestampMixin, table=True):
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
    tier: int = Field(default=20)

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
    invitations: list["AllianceInvitation"] = Relationship(
        back_populates="alliance",
        sa_relationship_kwargs={"foreign_keys": "[AllianceInvitation.alliance_id]"},
    )
    visitors: list["AllianceVisitor"] = Relationship(back_populates="alliance")

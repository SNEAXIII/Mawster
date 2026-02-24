import uuid
from datetime import datetime
from typing import List, TYPE_CHECKING
import sqlalchemy as sa
from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from src.models.GameAccount import GameAccount
    from src.models.AllianceOfficer import AllianceOfficer


class Alliance(SQLModel, table=True):
    __tablename__ = "alliance"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field(max_length=100)
    tag: str = Field(max_length=10)
    owner_id: uuid.UUID = Field(
        sa_column=sa.Column(
            sa.Uuid(),
            sa.ForeignKey("game_account.id", use_alter=True),
            nullable=False,
        )
    )
    created_at: datetime = Field(default_factory=datetime.now)
    # TODO: add url field later

    # Relations
    owner: "GameAccount" = Relationship(
        back_populates="owned_alliance",
        sa_relationship_kwargs={"foreign_keys": "[Alliance.owner_id]"},
    )
    members: List["GameAccount"] = Relationship(
        back_populates="alliance",
        sa_relationship_kwargs={"foreign_keys": "[GameAccount.alliance_id]"},
    )
    officers: List["AllianceOfficer"] = Relationship(back_populates="alliance")

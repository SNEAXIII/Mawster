import uuid
from datetime import datetime
from typing import Optional, TYPE_CHECKING
from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from src.models.Alliance import Alliance
    from src.models.GameAccount import GameAccount


class AllianceAdjoint(SQLModel, table=True):
    """Association table: a game account designated as adjoint (deputy) of an alliance."""
    __tablename__ = "alliance_adjoint"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    alliance_id: uuid.UUID = Field(foreign_key="alliance.id")
    game_account_id: uuid.UUID = Field(foreign_key="game_account.id")
    assigned_at: datetime = Field(default_factory=datetime.now)

    # Relations
    alliance: "Alliance" = Relationship(back_populates="adjoints")
    game_account: "GameAccount" = Relationship(back_populates="adjoint_entries")

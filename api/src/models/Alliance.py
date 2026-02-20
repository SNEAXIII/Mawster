import uuid
from datetime import datetime
from typing import List, Optional, TYPE_CHECKING
from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from src.models.GameAccount import GameAccount


class Alliance(SQLModel, table=True):
    __tablename__ = "alliance"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field(max_length=100)
    tag: str = Field(max_length=10)
    created_at: datetime = Field(default_factory=datetime.now)
    # TODO: add url field later

    # Relations
    members: List["GameAccount"] = Relationship(back_populates="alliance")

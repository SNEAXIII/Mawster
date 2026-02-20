import uuid
from datetime import datetime
from typing import List, Optional, TYPE_CHECKING
from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from src.models.User import User
    from src.models.Alliance import Alliance
    from src.models.ChampionUser import ChampionUser


class GameAccount(SQLModel, table=True):
    __tablename__ = "game_account"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="user.id")
    alliance_id: Optional[uuid.UUID] = Field(default=None, foreign_key="alliance.id")
    game_pseudo: str = Field(max_length=50)
    is_primary: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.now)

    # Relations
    user: "User" = Relationship(back_populates="game_accounts")
    alliance: Optional["Alliance"] = Relationship(back_populates="members")
    roster: List["ChampionUser"] = Relationship(back_populates="game_account")

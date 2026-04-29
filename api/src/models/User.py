import uuid
from datetime import datetime
from typing import List, Optional, TYPE_CHECKING
from sqlmodel import Relationship, Field, SQLModel

from src.enums.Roles import Roles

if TYPE_CHECKING:
    from src.models.LoginLog import LoginLog
    from src.models.GameAccount import GameAccount


class User(SQLModel, table=True):
    __tablename__ = "user"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    login: str = Field(unique=True)
    email_hash: Optional[str] = Field(default=None, unique=True)
    email_hash_version: int = Field(default=1)
    disabled_at: Optional[datetime] = Field(default=None)
    deleted_at: Optional[datetime] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.now)
    last_login_date: Optional[datetime] = Field(default=None)
    role: Roles = Field(default=Roles.USER)

    # OAuth fields
    discord_id: Optional[str] = Field(default=None, unique=True, index=True)
    google_id: Optional[str] = Field(default=None, unique=True, index=True)
    # Relations
    connexions: List["LoginLog"] = Relationship(back_populates="user")
    game_accounts: List["GameAccount"] = Relationship(back_populates="user")

    def set_last_login_date(self, date: datetime):
        self.last_login_date = date

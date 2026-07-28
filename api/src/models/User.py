from datetime import datetime
from typing import TYPE_CHECKING

from sqlmodel import Field, Relationship

from src.enums.Roles import Roles
from src.models.Base import TimestampMixin, UUIDBase

if TYPE_CHECKING:
    from src.models.GameAccount import GameAccount
    from src.models.LoginLog import LoginLog


class User(UUIDBase, TimestampMixin, table=True):
    __tablename__ = "user"

    login: str = Field(unique=True)
    email_hash: str | None = Field(default=None, unique=True)
    email_hash_version: int = Field(default=1)
    disabled_at: datetime | None = Field(default=None)
    deleted_at: datetime | None = Field(default=None)
    last_login_date: datetime | None = Field(default=None)
    role: Roles = Field(default=Roles.USER)

    # OAuth fields
    discord_id: str | None = Field(default=None, unique=True, index=True)
    google_id: str | None = Field(default=None, unique=True, index=True)
    # Relations
    connexions: list["LoginLog"] = Relationship(back_populates="user")
    game_accounts: list["GameAccount"] = Relationship(back_populates="user")

    def set_last_login_date(self, date: datetime):
        self.last_login_date = date

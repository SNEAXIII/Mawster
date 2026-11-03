from datetime import datetime
from typing import TYPE_CHECKING

from sqlmodel import Field, Relationship

from src.enums.LoginEventKind import LoginEventKind
from src.models.Base import UserFk, UUIDBase, utcnow

if TYPE_CHECKING:
    from src.models.user.User import User


class LoginLog(UUIDBase, UserFk, table=True):
    __tablename__ = "login_log"

    date_connexion: datetime = Field(default_factory=utcnow)
    # SQLAlchemy's Enum stores member names, so the server default is the name, not the value.
    kind: LoginEventKind = Field(
        default=LoginEventKind.LOGIN,
        sa_column_kwargs={"server_default": LoginEventKind.LOGIN.name},
    )

    # Relations
    user: "User" = Relationship(back_populates="connexions")

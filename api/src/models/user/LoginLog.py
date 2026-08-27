import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlmodel import Field, Relationship

from src.models.Base import FK_USER, UUIDBase, utcnow

if TYPE_CHECKING:
    from src.models.user.User import User


class LoginLog(UUIDBase, table=True):
    __tablename__ = "login_log"

    date_connexion: datetime = Field(default_factory=utcnow)
    id_user: uuid.UUID = Field(foreign_key=FK_USER)

    # Relations
    user: "User" = Relationship(back_populates="connexions")

import uuid
from datetime import datetime
from typing import TYPE_CHECKING
from sqlmodel import Field, Relationship

from src.models.Base import UUIDBase, utcnow

if TYPE_CHECKING:
    from src.models.User import User


class LoginLog(UUIDBase, table=True):
    __tablename__ = "login_log"

    date_connexion: datetime = Field(default_factory=utcnow)
    id_user: uuid.UUID = Field(foreign_key="user.id")

    # Relations
    user: "User" = Relationship(back_populates="connexions")

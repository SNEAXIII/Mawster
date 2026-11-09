import uuid
from typing import TYPE_CHECKING

from sqlmodel import Field, Relationship

from src.models.Base import FK_CHAMPION, FK_USER, TimestampMixin, UUIDBase

if TYPE_CHECKING:
    from src.models.champion.Champion import Champion
    from src.models.user.User import User


class AscensionRequest(UUIDBase, TimestampMixin, table=True):
    __tablename__ = "ascension_request"

    champion_id: uuid.UUID = Field(foreign_key=FK_CHAMPION, unique=True, ondelete="CASCADE")
    requester_user_id: uuid.UUID = Field(foreign_key=FK_USER, ondelete="CASCADE")

    # Relations
    champion: "Champion" = Relationship()
    requester: "User" = Relationship()

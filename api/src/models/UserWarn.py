import uuid

import sqlalchemy as sa
from sqlmodel import Field

from src.models.Base import TimestampMixin, UUIDBase


class UserWarn(UUIDBase, TimestampMixin, table=True):
    """A warning visible to the warned user. No auto-escalation."""

    __tablename__ = "user_warn"

    user_id: uuid.UUID = Field(foreign_key="user.id")
    reason: str = Field(sa_column=sa.Column(sa.Text, nullable=False))
    warned_by_id: uuid.UUID = Field(foreign_key="user.id")

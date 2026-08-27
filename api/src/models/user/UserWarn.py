import uuid

import sqlalchemy as sa
from sqlmodel import Field

from src.models.Base import FK_USER, TimestampMixin, UserFk, UUIDBase


class UserWarn(UUIDBase, UserFk, TimestampMixin, table=True):
    """A warning visible to the warned user. No auto-escalation."""

    __tablename__ = "user_warn"

    reason: str = Field(sa_column=sa.Column(sa.Text, nullable=False))
    warned_by_id: uuid.UUID = Field(foreign_key=FK_USER)

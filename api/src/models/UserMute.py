import uuid
from datetime import datetime
from typing import Optional

import sqlalchemy as sa
from sqlmodel import Field

from src.models.Base import TimestampMixin, UUIDBase


class UserMute(UUIDBase, TimestampMixin, table=True):
    """Blocks note editing AND reporting. Reason is visible to the muted user and admins."""

    __tablename__ = "user_mute"

    user_id: uuid.UUID = Field(foreign_key="user.id")
    reason: str = Field(sa_column=sa.Column(sa.Text, nullable=False))
    muted_by_id: uuid.UUID = Field(foreign_key="user.id")
    expires_at: Optional[datetime] = Field(default=None)  # null = permanent
    lifted_at: Optional[datetime] = Field(default=None)
    lifted_by_id: Optional[uuid.UUID] = Field(default=None, foreign_key="user.id")

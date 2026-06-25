import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlmodel import Field, SQLModel


class UserWarn(SQLModel, table=True):
    """A warning visible to the warned user. No auto-escalation."""

    __tablename__ = "user_warn"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="user.id")
    reason: str = Field(sa_column=sa.Column(sa.Text, nullable=False))
    warned_by_id: uuid.UUID = Field(foreign_key="user.id")
    created_at: datetime = Field(default_factory=datetime.now)

import uuid
from datetime import datetime
from typing import Any

import sqlalchemy as sa
from sqlmodel import Field

from src.enums.Roles import Roles
from src.models.Base import FK_USER, UUIDBase, utcnow


class AdminAuditEntry(UUIDBase, table=True):
    __tablename__ = "admin_audit_entry"

    created_at: datetime = Field(default_factory=utcnow, index=True)
    user_id: uuid.UUID | None = Field(default=None, foreign_key=FK_USER, index=True)
    role: Roles | None = Field(default=None)
    method: str
    route: str = Field(index=True)
    status_code: int
    # ponytail: not indexed, so searching inside details scans the table;
    # add a generated column on the key that gets searched if that ever matters.
    details: dict[str, Any] | None = Field(
        default=None, sa_column=sa.Column(sa.JSON(none_as_null=True), nullable=True)
    )

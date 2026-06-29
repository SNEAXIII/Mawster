import uuid
from datetime import datetime, timezone

from sqlmodel import Field, SQLModel


def utcnow() -> datetime:
    """Timezone-aware UTC timestamp.

    Use as ``Field(default_factory=utcnow)`` for every timestamp column so values are
    comparable regardless of the host timezone (never use the naive ``datetime.now``).
    """
    return datetime.now(timezone.utc)


class UUIDBase(SQLModel):
    """Shared base for every table model: provides the UUID primary key.

    Inherit with ``table=True``, e.g. ``class Foo(UUIDBase, table=True): ...``.
    """

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)


class TimestampMixin(SQLModel):
    """Adds a timezone-aware UTC ``created_at`` column.

    Combine with :class:`UUIDBase`, e.g.
    ``class Foo(UUIDBase, TimestampMixin, table=True): ...``.
    """

    created_at: datetime = Field(default_factory=utcnow)

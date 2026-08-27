import uuid
from datetime import UTC, datetime
from typing import Annotated

from sqlmodel import Field, SQLModel

# War-grid coordinate types — single source of truth for the bounds, shared by every
# war/defense model so the constraints can never drift apart between tables.
Battlegroup = Annotated[int, Field(ge=1, le=3)]
NodeNumber = Annotated[int, Field(ge=1, le=50)]

# Champion-stat types — same single-source-of-truth idea for the in-game stat ranges.
# Used by both the canonical models (ChampionUser, WarDefensePlacement) and the war
# fight-record snapshots, so a record can never silently store an out-of-range stat.
Stars = Annotated[int, Field(ge=6, le=7)]
Rank = Annotated[int, Field(ge=1, le=6)]
Ascension = Annotated[int, Field(ge=0, le=2)]
KoCount = Annotated[int, Field(ge=0)]


def utcnow() -> datetime:
    """Timezone-aware UTC timestamp.

    Use as ``Field(default_factory=utcnow)`` for every timestamp column so values are
    comparable regardless of the host timezone (never use the naive ``datetime.now``).
    """
    return datetime.now(UTC)


class UUIDBase(SQLModel):
    """Shared base for every table model: provides the UUID primary key.

    Inherit with ``table=True``, e.g. ``class Foo(UUIDBase, table=True): ...``.
    """

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)


class GameAccountFk(SQLModel):
    game_account_id: uuid.UUID = Field(foreign_key="game_account.id")


class TimestampMixin(SQLModel):
    """Adds a timezone-aware UTC ``created_at`` column.

    Combine with :class:`UUIDBase`, e.g.
    ``class Foo(UUIDBase, TimestampMixin, table=True): ...``.
    """

    created_at: datetime = Field(default_factory=utcnow)


def as_utc(value: datetime) -> datetime:
    """Return ``value`` as a timezone-aware UTC datetime.

    Timestamps read back from the database come out naive (the drivers drop the
    tzinfo), so comparing them with :func:`utcnow` would raise. Normalize both
    sides through this helper before any Python-side comparison.
    """
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)

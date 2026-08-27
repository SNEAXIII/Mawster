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


class UserFk(SQLModel):
    """Adds the FK to the owning ``user`` row.

    LoginLog is the one table that stays out: its column is named ``id_user``, and
    renaming it would cost a migration for no behaviour change.
    """

    user_id: uuid.UUID = Field(foreign_key="user.id")


class GameAccountFk(SQLModel):
    """Adds the FK to the owning ``game_account`` row.

    The reference mixin of the family: every table that belongs to a single game
    account declares the column here rather than restating it.
    """

    game_account_id: uuid.UUID = Field(foreign_key="game_account.id")


class AuthorshipFk(SQLModel):
    """Adds the pair of FKs tracking who created and who last edited the row.

    Both are required: a row always has an author, and ``updated_by`` starts equal to
    ``created_by``.
    """

    created_by_game_account_id: uuid.UUID = Field(foreign_key="game_account.id")
    updated_by_game_account_id: uuid.UUID = Field(foreign_key="game_account.id")


class PlacedByFk(SQLModel):
    """Adds the optional FK to the game account that placed the defender.

    Nullable: rows imported or created before the column existed have no known author.
    """

    placed_by_id: uuid.UUID | None = Field(default=None, foreign_key="game_account.id")


class AllianceFk(SQLModel):
    """Adds the FK to the owning ``alliance`` row.

    Same single-source-of-truth intent as :class:`GameAccountFk`.
    """

    alliance_id: uuid.UUID = Field(foreign_key="alliance.id")


class ChampionFk(SQLModel):
    """Adds the FK to the ``champion`` catalog table.

    Same single-source-of-truth intent as :class:`GameAccountFk`: every table that
    points at a champion declares the column identically.
    """

    champion_id: uuid.UUID = Field(foreign_key="champion.id")


class ChampionUserFk(SQLModel):
    """Adds the FK to a roster entry — a champion owned by a game account.

    Distinct from :class:`ChampionFk`, which points at the champion catalog: this one
    designates one player's copy, with its stars, rank and signature.
    """

    champion_user_id: uuid.UUID = Field(foreign_key="champion_user.id")


class WarFightRecordFk(SQLModel):
    """Adds the FK to the fight record a row details.

    Required here: a synergy or a prefight only exists as part of one recorded fight.
    WarFightNote keeps its own nullable column — a note can stand without a record.
    """

    war_fight_record_id: uuid.UUID = Field(foreign_key="war_fight_record.id")


class SeasonFk(SQLModel):
    """Adds the optional FK to the ``season`` row.

    Nullable on purpose: rows created outside a running season carry no season.
    """

    season_id: uuid.UUID | None = Field(default=None, foreign_key="season.id")


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

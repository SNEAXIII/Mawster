import uuid
from datetime import UTC, datetime

from sqlmodel import Field, SQLModel

# The bounded scalar types live in src.game_types so the DTOs can share them without
# importing a model. Re-exported here because every model already reaches for them
# through this module.
from src.game_types import (  # noqa: F401
    Ascension,
    Battlegroup,
    KoCount,
    NodeNumber,
    Rank,
    Signature,
    Stars,
    Tier,
)

# Foreign-key targets, spelled once each. A table rename otherwise leaves stale strings
# scattered across the models, and SQLModel only notices at mapper configuration time.
FK_ALLIANCE = "alliance.id"
FK_CHAMPION = "champion.id"
FK_CHAMPION_USER = "champion_user.id"
FK_GAME_ACCOUNT = "game_account.id"
FK_MASTERY = "mastery.id"
FK_MATCHUP_RATING = "matchup_rating.id"
FK_SEASON = "season.id"
FK_USER = "user.id"
FK_VISION_IMPORT = "vision_import.id"
FK_VISION_JOB = "vision_job.id"
FK_VISION_PREDICTION = "vision_prediction.id"
FK_WAR = "war.id"
FK_WAR_DEFENSE_PLACEMENT = "war_defense_placement.id"
FK_WAR_FIGHT_NOTE = "war_fight_note.id"
FK_WAR_FIGHT_RECORD = "war_fight_record.id"


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

    For a table hanging off a game account rather than an account-less user, see
    :class:`GameAccountFk`.
    """

    user_id: uuid.UUID = Field(foreign_key=FK_USER)


class GameAccountFk(SQLModel):
    """Adds the FK to the owning ``game_account`` row.

    The reference mixin of the family: every table that belongs to a single game
    account declares the column here rather than restating it.
    """

    game_account_id: uuid.UUID = Field(foreign_key=FK_GAME_ACCOUNT)


class AuthorshipFk(SQLModel):
    """Adds the pair of FKs tracking who created and who last edited the row.

    Both are required: a row always has an author, and ``updated_by`` starts equal to
    ``created_by``.
    """

    created_by_game_account_id: uuid.UUID = Field(foreign_key=FK_GAME_ACCOUNT)
    updated_by_game_account_id: uuid.UUID = Field(foreign_key=FK_GAME_ACCOUNT)


class PlacedByFk(SQLModel):
    """Adds the optional FK to the game account that placed the defender.

    Nullable: rows imported or created before the column existed have no known author.
    """

    placed_by_id: uuid.UUID | None = Field(default=None, foreign_key=FK_GAME_ACCOUNT)


class WarFk(SQLModel):
    """Adds the FK to the ``war`` a row belongs to.

    WarBan keeps its own indexed version; every other war-scoped table declares the
    column here rather than restating it.
    """

    war_id: uuid.UUID = Field(foreign_key=FK_WAR)


class WarCoords(SQLModel):
    """Adds the pair of coordinates locating a row on the war map.

    Battlegroup and node always travel together: a node number means nothing without
    the battlegroup it belongs to.
    """

    battlegroup: Battlegroup
    node_number: NodeNumber


class SoftDelete(SQLModel):
    """Adds the soft-delete timestamp.

    A deleted row keeps its history readable — past wars, placements and stats still
    resolve — so deletion is a timestamp, never a DELETE.
    """

    deleted_at: datetime | None = Field(default=None)


class AllianceFk(SQLModel):
    """Adds the FK to the owning ``alliance`` row.

    Same single-source-of-truth intent as :class:`GameAccountFk`.
    """

    alliance_id: uuid.UUID = Field(foreign_key=FK_ALLIANCE)


class ChampionFk(SQLModel):
    """Adds the FK to the ``champion`` catalog table.

    Same single-source-of-truth intent as :class:`GameAccountFk`: every table that
    points at a champion declares the column identically.
    """

    champion_id: uuid.UUID = Field(foreign_key=FK_CHAMPION)


class DefenderChampionFk(SQLModel):
    """Adds the FK to the champion that was defending.

    Pairs with :class:`ChampionFk` on the fight records, where the attacker column is
    the plain ``champion_id``. MatchupRating keeps its own nullable version.
    """

    defender_champion_id: uuid.UUID = Field(foreign_key=FK_CHAMPION)


class ChampionUserFk(SQLModel):
    """Adds the FK to a roster entry — a champion owned by a game account.

    Distinct from :class:`ChampionFk`, which points at the champion catalog: this one
    designates one player's copy, with its stars, rank and signature.
    """

    champion_user_id: uuid.UUID = Field(foreign_key=FK_CHAMPION_USER)


class WarFightRecordFk(SQLModel):
    """Adds the FK to the fight record a row details.

    Required here: a synergy or a prefight only exists as part of one recorded fight.
    WarFightNote keeps its own nullable column — a note can stand without a record.
    """

    war_fight_record_id: uuid.UUID = Field(foreign_key=FK_WAR_FIGHT_RECORD)


class SeasonFk(SQLModel):
    """Adds the optional FK to the ``season`` row.

    Nullable on purpose: rows created outside a running season carry no season.
    """

    season_id: uuid.UUID | None = Field(default=None, foreign_key=FK_SEASON)


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

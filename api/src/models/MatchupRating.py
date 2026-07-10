import uuid
from datetime import datetime
from typing import List, Optional, TYPE_CHECKING

import sqlalchemy as sa
from sqlmodel import Field, Relationship

from src.enums.MatchupTargetType import MatchupTargetType
from src.enums.MatchupVerdict import MatchupVerdict
from src.models.Base import NodeNumber, TimestampMixin, UUIDBase, utcnow

if TYPE_CHECKING:
    from src.models.Champion import Champion
    from src.models.MatchupSynergy import MatchupSynergy


class MatchupRating(UUIDBase, TimestampMixin, table=True):
    """One alliance's verdict on `champion versus obstacle`, where the obstacle is either a
    defender champion or a node — never both."""

    __tablename__ = "matchup_rating"
    __table_args__ = (
        sa.UniqueConstraint(
            "alliance_id", "champion_id", "target_key", name="uq_matchup_rating_target"
        ),
        # Compared against the enum *member names* ('DEFENDER'/'NODE'), not their .value
        # ('defender'/'node'): SQLAlchemy's Enum(PyEnumClass) binds the member name to the DB
        # by default. MariaDB's default collation is case-insensitive so 'defender' would also
        # match there, but the SQLite engine used by integration tests is case-sensitive and
        # would reject every valid row if this compared against the lowercase values instead.
        sa.CheckConstraint(
            "(target_type = 'DEFENDER'"
            " AND defender_champion_id IS NOT NULL AND node_number IS NULL)"
            " OR (target_type = 'NODE'"
            " AND node_number IS NOT NULL AND defender_champion_id IS NULL)",
            name="ck_matchup_rating_single_target",
        ),
    )

    alliance_id: uuid.UUID = Field(foreign_key="alliance.id")
    champion_id: uuid.UUID = Field(foreign_key="champion.id")
    target_type: MatchupTargetType
    defender_champion_id: Optional[uuid.UUID] = Field(default=None, foreign_key="champion.id")
    node_number: Optional[NodeNumber] = Field(default=None)
    # Denormalised target discriminant — see services/alliance/matchup_scoring.build_target_key.
    target_key: str = Field(max_length=64)
    verdict: MatchupVerdict
    prefight_champion_id: Optional[uuid.UUID] = Field(default=None, foreign_key="champion.id")
    # Never written in v1. NULL means "applies to every season".
    season_id: Optional[uuid.UUID] = Field(default=None, foreign_key="season.id")
    created_by_game_account_id: uuid.UUID = Field(foreign_key="game_account.id")
    updated_by_game_account_id: uuid.UUID = Field(foreign_key="game_account.id")
    updated_at: datetime = Field(default_factory=utcnow)

    champion: "Champion" = Relationship(
        sa_relationship_kwargs={
            "foreign_keys": "[MatchupRating.champion_id]",
            "overlaps": "defender_champion,prefight_champion",
        }
    )
    defender_champion: Optional["Champion"] = Relationship(
        sa_relationship_kwargs={
            "foreign_keys": "[MatchupRating.defender_champion_id]",
            "overlaps": "champion,prefight_champion",
        }
    )
    prefight_champion: Optional["Champion"] = Relationship(
        sa_relationship_kwargs={
            "foreign_keys": "[MatchupRating.prefight_champion_id]",
            "overlaps": "champion,defender_champion",
        }
    )
    synergies: List["MatchupSynergy"] = Relationship(back_populates="rating", cascade_delete=True)

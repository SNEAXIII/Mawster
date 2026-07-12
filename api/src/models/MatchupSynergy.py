import uuid
from typing import TYPE_CHECKING

import sqlalchemy as sa
from sqlmodel import Field, Relationship

from src.models.Base import UUIDBase

if TYPE_CHECKING:
    from src.models.Champion import Champion
    from src.models.MatchupRating import MatchupRating


class MatchupSynergy(UUIDBase, table=True):
    """A synergy champion attached to a rating.

    ``is_required`` gates the rating: a missing required synergy makes the rated fight
    unplayable. A recommended synergy is informational and never gates anything.
    The at-most-two limit is enforced in MatchupService — SQL cannot express it cleanly.
    """

    __tablename__ = "matchup_synergy"
    __table_args__ = (
        sa.UniqueConstraint("matchup_rating_id", "champion_id", name="uq_matchup_synergy_champion"),
    )

    matchup_rating_id: uuid.UUID = Field(foreign_key="matchup_rating.id", ondelete="CASCADE")
    champion_id: uuid.UUID = Field(foreign_key="champion.id")
    is_required: bool = Field(default=True)

    rating: "MatchupRating" = Relationship(back_populates="synergies")
    champion: "Champion" = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[MatchupSynergy.champion_id]"}
    )

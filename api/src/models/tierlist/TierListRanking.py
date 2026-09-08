import uuid
from typing import TYPE_CHECKING, Optional

import sqlalchemy as sa
from sqlmodel import Field, Relationship

from src.models.Base import FK_TIERLIST_TIER, ChampionFk, TierListFk, UUIDBase

if TYPE_CHECKING:
    from src.models.tierlist.TierListTier import TierListTier


class TierListRanking(UUIDBase, TierListFk, ChampionFk, table=True):
    """One champion sitting in one tier, at a position.

    ``tierlist_id`` duplicates what ``tier_id`` already implies, and is kept so the
    unique constraint below can exist: a champion appears at most once per tier list,
    and two tiers of the same list are two different parents.
    """

    __tablename__ = "tierlist_ranking"
    __table_args__ = (
        sa.UniqueConstraint("tierlist_id", "champion_id", name="uq_tierlist_ranking_champion"),
    )

    tier_id: uuid.UUID = Field(foreign_key=FK_TIERLIST_TIER, ondelete="CASCADE")
    position: int = Field(ge=0)

    tier: Optional["TierListTier"] = Relationship(back_populates="rankings")

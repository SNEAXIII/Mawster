from typing import TYPE_CHECKING, Optional

import sqlalchemy as sa
from sqlmodel import Field, Relationship

from src.models.Base import TierListFk, UUIDBase

if TYPE_CHECKING:
    from src.models.tierlist.TierList import TierList
    from src.models.tierlist.TierListRanking import TierListRanking


class TierListTier(UUIDBase, TierListFk, table=True):
    """One row of a tier list: a label, a colour and where it sits.

    Not the alliance Tier, which is a competitive bracket — see the glossary.
    """

    __tablename__ = "tierlist_tier"
    __table_args__ = (
        sa.UniqueConstraint("tierlist_id", "position", name="uq_tierlist_tier_position"),
    )

    label: str = Field(max_length=40)
    color: str = Field(max_length=32)
    position: int = Field(ge=0)

    tierlist: Optional["TierList"] = Relationship(back_populates="tiers")
    rankings: list["TierListRanking"] = Relationship(back_populates="tier", cascade_delete=True)

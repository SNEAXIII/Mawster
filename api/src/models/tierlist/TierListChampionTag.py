from typing import TYPE_CHECKING, Optional

import sqlalchemy as sa
from sqlmodel import Field, Relationship

from src.models.Base import ChampionFk, Signature, TierListFk, UUIDBase

if TYPE_CHECKING:
    from src.models.tierlist.TierList import TierList


class TierListChampionTag(UUIDBase, TierListFk, ChampionFk, table=True):
    """What the owner marked on one champion inside one tier list.

    Opinions, not facts: ``is_defender`` says "I rate it on defense" and has nothing to
    do with ``ChampionSagaRole.is_saga_defender``, which is a season bonus the game
    grants. ``is_battlegrounds`` names the game's PvP mode, never Mawster's battlegroup.

    A champion tagged both attacker and defender reads as a dual threat — derived on
    display, never stored, so the two can never disagree with the badge.
    """

    __tablename__ = "tierlist_champion_tag"
    __table_args__ = (
        sa.UniqueConstraint("tierlist_id", "champion_id", name="uq_tierlist_tag_champion"),
    )

    is_six_star_only: bool = Field(default=False)
    is_attacker: bool = Field(default=False)
    is_defender: bool = Field(default=False)
    is_alliance_war: bool = Field(default=False)
    is_battlegrounds: bool = Field(default=False)
    is_awakened: bool = Field(default=False)
    signature: Signature = 0

    tierlist: Optional["TierList"] = Relationship(back_populates="tags")

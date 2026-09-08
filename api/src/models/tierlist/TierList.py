from typing import TYPE_CHECKING

from sqlmodel import Field, Relationship

from src.models.Base import TimestampMixin, UserFk, UUIDBase

if TYPE_CHECKING:
    from src.models.tierlist.TierListChampionTag import TierListChampionTag
    from src.models.tierlist.TierListTier import TierListTier


class TierList(UUIDBase, UserFk, TimestampMixin, table=True):
    """A ranked opinion about champions, held by an account.

    The one table in the game domain hanging off ``user`` rather than ``game_account``:
    the same opinion serves every player an account binds, and it is never shown inside
    an alliance (see ``docs/adr/0007-tier-lists-belong-to-the-account.md``).
    """

    __tablename__ = "tierlist"

    title: str = Field(default="", max_length=100)

    tiers: list["TierListTier"] = Relationship(back_populates="tierlist", cascade_delete=True)
    tags: list["TierListChampionTag"] = Relationship(back_populates="tierlist", cascade_delete=True)

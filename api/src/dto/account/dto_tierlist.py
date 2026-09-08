import uuid
from datetime import datetime
from typing import Self

from pydantic import BaseModel, ConfigDict, Field, model_validator

from src.game_types import Signature
from src.Messages.tierlist_messages import (
    duplicate_ranking,
    duplicate_tag,
    too_many_rankings,
)

# Guard rails on a save payload. Neither is a game rule: they bound what a single
# request may carry, the way the 10-player cap bounds an account.
MAX_TIERS_PER_LIST = 50
MAX_TAGS_PER_LIST = 1000
# A champion is ranked at most once per list, so the real ceiling is the size of the
# catalog. Held well above it rather than read from the database: the bound exists to
# stop a flood of unknown ids reaching the query that checks them, not to be exact.
MAX_RANKED_CHAMPIONS_PER_LIST = 1000


class TierListTagFields(BaseModel):
    """The marks one champion carries inside one tier list.

    Spelled once: the save payload and the response carry the same set, and a tag added
    to one and not the other is a bug waiting in the round trip.
    """

    champion_id: uuid.UUID
    is_six_star_only: bool = False
    is_attacker: bool = False
    is_defender: bool = False
    is_alliance_war: bool = False
    is_battlegrounds: bool = False
    is_awakened: bool = False
    signature: Signature = 0


class TierListTagPayload(TierListTagFields):
    """The marks set on one champion inside the list being saved."""


class TierListTierPayload(BaseModel):
    """One row being saved. Its position is where it sits in the request list."""

    label: str = Field(..., max_length=40, examples=["S"])
    color: str = Field(..., max_length=32, examples=["#ff7f7f"])
    champion_ids: list[uuid.UUID] = Field(
        default_factory=list, max_length=MAX_RANKED_CHAMPIONS_PER_LIST
    )


class TierListSaveRequest(BaseModel):
    """A whole tier list, as the front sends it back.

    The board travels complete on every save: rows in order, champions in order inside
    each row, and every tag. Nothing is patched — see the tier list debt in CONTEXT.md.
    """

    title: str = Field(default="", max_length=100)
    tiers: list[TierListTierPayload] = Field(..., min_length=1, max_length=MAX_TIERS_PER_LIST)
    tags: list[TierListTagPayload] = Field(default_factory=list, max_length=MAX_TAGS_PER_LIST)

    @model_validator(mode="after")
    def _reject_duplicate_champions(self) -> Self:
        """A champion sits in at most one row, and carries at most one set of tags.

        The database says the same thing, but a 400 naming the champion beats a driver
        error on a unique constraint.
        """
        ranked: set[uuid.UUID] = set()
        if sum(len(tier.champion_ids) for tier in self.tiers) > MAX_RANKED_CHAMPIONS_PER_LIST:
            message = too_many_rankings(MAX_RANKED_CHAMPIONS_PER_LIST)
            raise ValueError(message)
        for tier in self.tiers:
            for champion_id in tier.champion_ids:
                if champion_id in ranked:
                    message = duplicate_ranking(champion_id)
                    raise ValueError(message)
                ranked.add(champion_id)
        tagged: set[uuid.UUID] = set()
        for tag in self.tags:
            if tag.champion_id in tagged:
                message = duplicate_tag(tag.champion_id)
                raise ValueError(message)
            tagged.add(tag.champion_id)
        return self


class TierListTagResponse(TierListTagFields):
    """The marks set on one champion, as stored."""

    model_config = ConfigDict(from_attributes=True)


class TierListTierResponse(BaseModel):
    """One row and the champions it holds, in display order."""

    id: uuid.UUID
    label: str
    color: str
    position: int
    champion_ids: list[uuid.UUID]


class TierListSummaryResponse(BaseModel):
    """A tier list as the picker lists it, without loading its contents."""

    id: uuid.UUID
    title: str
    created_at: datetime
    tier_count: int
    ranked_champion_count: int


class TierListDetailResponse(BaseModel):
    """A whole tier list, the shape the board reads and writes back."""

    id: uuid.UUID
    title: str
    created_at: datetime
    tiers: list[TierListTierResponse]
    tags: list[TierListTagResponse]

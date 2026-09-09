"""Field groups shared by several DTOs.

The same reason the models keep their FK mixins in ``models.Base``: a group of fields
spelled out in ten response schemas is a group that will drift. Response mixins carry no
validation bounds — they describe what the API returns, and a response should never
reject data the database already holds. Request mixins are the exception and do keep
their bounds, since rejecting bad input is exactly their job.
"""

import uuid

from pydantic import BaseModel, ConfigDict, Field

from src.game_types import Ascension, Signature


class PlayerIdentity(BaseModel):
    """The player a row belongs to, as every response spells them out."""

    game_account_id: uuid.UUID
    game_pseudo: str


class WarCoords(BaseModel):
    """Where on the war map a row sits."""

    battlegroup: int
    node_number: int


class ChampionIdentity(BaseModel):
    """How a champion is rendered: the name, the class badge and the portrait."""

    champion_name: str
    champion_class: str
    image_url: str | None = None


class ChampionRef(ChampionIdentity):
    """A champion identified as well as rendered — the shape a nested reference takes."""

    model_config = ConfigDict(from_attributes=True)

    champion_id: uuid.UUID


class SagaRoles(BaseModel):
    """Whether a champion is a saga attacker or defender.

    Only meaningful when the query carried a season_id; false otherwise.
    """

    is_saga_attacker: bool = False
    is_saga_defender: bool = False


class RosterEntryInput(BaseModel):
    """What a player states about a champion they own, on the way in."""

    rarity: str = Field(..., examples=["6r4"])
    signature: Signature = Field(default=0, examples=[200])
    is_preferred_attacker: bool = Field(default=False)
    ascension: Ascension = Field(default=0, examples=[0])

import uuid
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, model_validator


class AllianceRosterEntryResponse(BaseModel):
    """A single alliance member's champion entry — solo RosterEntry shape + owner identity."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    game_account_id: uuid.UUID
    game_pseudo: str
    alliance_group: Optional[int] = None
    champion_id: uuid.UUID
    champion_name: str
    champion_class: str
    alias: Optional[str] = None
    image_url: Optional[str] = None
    rarity: str
    signature: int
    ascension: int = 0
    is_preferred_attacker: bool = False
    is_ascendable: bool = False
    is_saga_attacker: bool = False
    is_saga_defender: bool = False

    @model_validator(mode="before")
    @classmethod
    def flatten(cls, data: Any) -> Any:
        """Flatten the nested `.champion` and `.game_account` relationships."""
        if isinstance(data, dict):
            return data
        return {
            "id": data.id,
            "game_account_id": data.game_account_id,
            "game_pseudo": data.game_account.game_pseudo,
            "alliance_group": data.game_account.alliance_group,
            "champion_id": data.champion_id,
            "champion_name": data.champion.name,
            "champion_class": data.champion.champion_class,
            "alias": data.champion.alias,
            "image_url": data.champion.image_url,
            "rarity": data.rarity,
            "signature": data.signature,
            "ascension": data.ascension,
            "is_preferred_attacker": data.is_preferred_attacker,
            "is_ascendable": data.champion.is_ascendable,
        }

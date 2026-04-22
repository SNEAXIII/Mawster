import uuid
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator


class UpgradeRequestCreate(BaseModel):
    """DTO to create a new upgrade request."""

    champion_user_id: uuid.UUID = Field(..., examples=["550e8400-e29b-41d4-a716-446655440000"])
    requested_rarity: str = Field(..., examples=["7r3"])


class UpgradeRequestResponse(BaseModel):
    """DTO for an upgrade request response."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    champion_user_id: uuid.UUID
    requester_game_account_id: uuid.UUID
    requester_pseudo: str
    requested_rarity: str
    current_rarity: str
    champion_name: str
    champion_class: str
    image_url: Optional[str] = None
    created_at: datetime
    done_at: Optional[datetime] = None

    @model_validator(mode="before")
    @classmethod
    def flatten_relations(cls, data: Any) -> Any:
        """Flatten `.champion_user.champion` and `.requester` relationships."""
        if isinstance(data, dict):
            return data
        return {
            "id": data.id,
            "champion_user_id": data.champion_user_id,
            "requester_game_account_id": data.requester_game_account_id,
            "requester_pseudo": data.requester.game_pseudo,
            "requested_rarity": data.requested_rarity,
            "current_rarity": data.champion_user.rarity,
            "champion_name": data.champion_user.champion.name,
            "champion_class": data.champion_user.champion.champion_class,
            "image_url": data.champion_user.champion.image_url,
            "created_at": data.created_at,
            "done_at": data.done_at,
        }

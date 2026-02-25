import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class UpgradeRequestCreate(BaseModel):
    """DTO to create a new upgrade request."""
    champion_user_id: uuid.UUID = Field(
        ..., examples=["550e8400-e29b-41d4-a716-446655440000"]
    )
    requested_rarity: str = Field(..., examples=["7r3"])


class UpgradeRequestResponse(BaseModel):
    """DTO for an upgrade request response."""
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

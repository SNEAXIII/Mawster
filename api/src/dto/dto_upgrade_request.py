import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from pydantic import BaseModel, Field

if TYPE_CHECKING:
    from src.models.RequestedUpgrade import RequestedUpgrade


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

    @classmethod
    def from_model(cls, m: "RequestedUpgrade") -> "UpgradeRequestResponse":
        """Build from a RequestedUpgrade with `.champion_user.champion` and `.requester` loaded."""
        return cls(
            id=m.id,
            champion_user_id=m.champion_user_id,
            requester_game_account_id=m.requester_game_account_id,
            requester_pseudo=m.requester.game_pseudo,
            requested_rarity=m.requested_rarity,
            current_rarity=m.champion_user.rarity,
            champion_name=m.champion_user.champion.name,
            champion_class=m.champion_user.champion.champion_class,
            image_url=m.champion_user.champion.image_url,
            created_at=m.created_at,
            done_at=m.done_at,
        )

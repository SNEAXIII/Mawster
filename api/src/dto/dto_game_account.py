import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from pydantic import BaseModel, Field

if TYPE_CHECKING:
    from src.models.GameAccount import GameAccount


class GameAccountCreateRequest(BaseModel):
    """DTO to create a new game account. Only a pseudo is required."""
    game_pseudo: str = Field(..., max_length=50, examples=["MyGamePseudo"])
    is_primary: bool = Field(default=False, examples=[True])


class GameAccountResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    alliance_id: Optional[uuid.UUID] = None
    alliance_group: Optional[int] = None
    alliance_tag: Optional[str] = None
    alliance_name: Optional[str] = None
    game_pseudo: str
    is_primary: bool
    created_at: datetime

    @classmethod
    def from_model(cls, account: "GameAccount") -> "GameAccountResponse":
        """Build from a GameAccount with optional `.alliance` loaded."""
        alliance = getattr(account, "alliance", None)
        return cls(
            id=account.id,
            user_id=account.user_id,
            alliance_id=account.alliance_id,
            alliance_group=account.alliance_group,
            alliance_tag=alliance.tag if alliance else None,
            alliance_name=alliance.name if alliance else None,
            game_pseudo=account.game_pseudo,
            is_primary=account.is_primary,
            created_at=account.created_at,
        )

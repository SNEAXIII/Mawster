import uuid
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator


class GameAccountCreateRequest(BaseModel):
    """DTO to create a new game account. Only a pseudo is required."""
    game_pseudo: str = Field(..., max_length=50, examples=["MyGamePseudo"])
    is_primary: bool = Field(default=False, examples=[True])


class GameAccountResponse(BaseModel):
    """DTO for a game account with optional alliance info."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    alliance_id: Optional[uuid.UUID] = None
    alliance_group: Optional[int] = None
    alliance_tag: Optional[str] = None
    alliance_name: Optional[str] = None
    game_pseudo: str
    is_primary: bool
    created_at: datetime

    @model_validator(mode='before')
    @classmethod
    def flatten_alliance(cls, data: Any) -> Any:
        """Flatten the optional `.alliance` relationship."""
        if isinstance(data, dict):
            return data
        try:
            alliance = getattr(data, 'alliance', None)
        except Exception:
            alliance = None
        return {
            'id': data.id,
            'user_id': data.user_id,
            'alliance_id': data.alliance_id,
            'alliance_group': data.alliance_group,
            'alliance_tag': alliance.tag if alliance else None,
            'alliance_name': alliance.name if alliance else None,
            'game_pseudo': data.game_pseudo,
            'is_primary': data.is_primary,
            'created_at': data.created_at,
        }

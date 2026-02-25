import uuid
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field


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

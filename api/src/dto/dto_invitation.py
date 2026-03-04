import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field

from src.enums.InvitationStatus import InvitationStatus


class AllianceInvitationCreateRequest(BaseModel):
    """DTO to invite a game account to an alliance."""
    game_account_id: uuid.UUID = Field(..., examples=["550e8400-e29b-41d4-a716-446655440000"])


class AllianceInvitationResponse(BaseModel):
    """Response DTO for an alliance invitation."""
    id: uuid.UUID
    alliance_id: uuid.UUID
    alliance_name: str
    alliance_tag: str
    game_account_id: uuid.UUID
    game_account_pseudo: str
    invited_by_game_account_id: uuid.UUID
    invited_by_pseudo: str
    status: InvitationStatus
    created_at: datetime
    responded_at: Optional[datetime] = None

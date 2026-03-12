import uuid
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator

from src.enums.InvitationStatus import InvitationStatus


class AllianceInvitationCreateRequest(BaseModel):
    """DTO to invite a game account to an alliance."""
    game_account_id: uuid.UUID = Field(..., examples=["550e8400-e29b-41d4-a716-446655440000"])


class AllianceInvitationResponse(BaseModel):
    """Response DTO for an alliance invitation."""
    model_config = ConfigDict(from_attributes=True)

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

    @model_validator(mode='before')
    @classmethod
    def flatten_relations(cls, data: Any) -> Any:
        """Flatten `.alliance`, `.game_account`, `.invited_by` relationships."""
        if isinstance(data, dict):
            return data
        return {
            'id': data.id,
            'alliance_id': data.alliance_id,
            'alliance_name': data.alliance.name,
            'alliance_tag': data.alliance.tag,
            'game_account_id': data.game_account_id,
            'game_account_pseudo': data.game_account.game_pseudo,
            'invited_by_game_account_id': data.invited_by_game_account_id,
            'invited_by_pseudo': data.invited_by.game_pseudo,
            'status': data.status,
            'created_at': data.created_at,
            'responded_at': data.responded_at,
        }

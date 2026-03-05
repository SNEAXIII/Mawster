import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from pydantic import BaseModel, Field

from src.enums.InvitationStatus import InvitationStatus

if TYPE_CHECKING:
    from src.models.AllianceInvitation import AllianceInvitation


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

    @classmethod
    def from_model(cls, inv: "AllianceInvitation") -> "AllianceInvitationResponse":
        """Build from an AllianceInvitation with `.alliance`, `.game_account`, `.invited_by` loaded."""
        return cls(
            id=inv.id,
            alliance_id=inv.alliance_id,
            alliance_name=inv.alliance.name,
            alliance_tag=inv.alliance.tag,
            game_account_id=inv.game_account_id,
            game_account_pseudo=inv.game_account.game_pseudo,
            invited_by_game_account_id=inv.invited_by_game_account_id,
            invited_by_pseudo=inv.invited_by.game_pseudo,
            status=inv.status,
            created_at=inv.created_at,
            responded_at=inv.responded_at,
        )

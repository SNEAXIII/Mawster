import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, model_validator


class AllianceVisitorResponse(BaseModel):
    """Response DTO for an alliance visitor."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    alliance_id: uuid.UUID
    game_account_id: uuid.UUID
    game_pseudo: str
    visited_at: datetime

    @model_validator(mode="before")
    @classmethod
    def flatten_game_account(cls, data: Any) -> Any:
        if isinstance(data, dict):
            return data
        return {
            "id": data.id,
            "alliance_id": data.alliance_id,
            "game_account_id": data.game_account_id,
            "game_pseudo": data.game_account.game_pseudo,
            "visited_at": data.visited_at,
        }

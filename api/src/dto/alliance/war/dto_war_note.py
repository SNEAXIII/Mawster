import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from src.dto.mixins import WarCoords
from src.utils.sanitize import sanitize_text

MAX_NOTE_LENGTH = 2000


class WarFightNoteUpsertRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=MAX_NOTE_LENGTH)

    @field_validator("content", mode="before")
    @classmethod
    def _sanitize_content(cls, value):
        return sanitize_text(value) if isinstance(value, str) else value


class WarFightNoteResponse(WarCoords):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    war_id: uuid.UUID
    content: str
    updated_by_pseudo: str | None = None
    updated_at: datetime

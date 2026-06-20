import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

MAX_NOTE_LENGTH = 2000


class WarFightNoteUpsertRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=MAX_NOTE_LENGTH)


class WarFightNoteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    war_id: uuid.UUID
    battlegroup: int
    node_number: int
    content: str
    updated_by_pseudo: Optional[str] = None
    updated_at: datetime

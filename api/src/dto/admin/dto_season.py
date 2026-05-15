import uuid
from pydantic import BaseModel, ConfigDict, Field


class SeasonCreateRequest(BaseModel):
    number: int = Field(..., ge=1)


class SeasonResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    number: int
    is_active: bool

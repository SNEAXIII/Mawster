import uuid
from pydantic import BaseModel, ConfigDict, Field


class SeasonCreateRequest(BaseModel):
    number: int = Field(..., ge=1, le=9999)
    is_big_thing: bool = Field(default=False)


class SeasonResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    number: int
    is_big_thing: bool

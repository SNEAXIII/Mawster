import uuid
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class MasteryCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=64)
    max_value: int = Field(..., ge=1)
    order: int = Field(default=0)


class MasteryUpdateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=64)
    order: int = Field(default=0)


class MasteryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    max_value: int
    order: int


class GameAccountMasteryUpsertItem(BaseModel):
    mastery_id: uuid.UUID
    unlocked: int = Field(..., ge=0)
    attack: int = Field(..., ge=0)
    defense: int = Field(..., ge=0)


class GameAccountMasteryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: Optional[uuid.UUID]
    mastery_id: uuid.UUID
    mastery_name: str
    mastery_max_value: int
    mastery_order: int
    unlocked: int
    attack: int
    defense: int

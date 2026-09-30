import uuid

from pydantic import BaseModel, ConfigDict, Field


class GameAccountMasteryUpsertItem(BaseModel):
    mastery_id: uuid.UUID
    unlocked: int = Field(..., ge=0)
    attack: int = Field(..., ge=0)
    defense: int = Field(..., ge=0)


class GameAccountMasteryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID | None = None
    mastery_id: uuid.UUID
    mastery_name: str
    mastery_max_value: int
    mastery_order: int
    unlocked: int
    attack: int
    defense: int

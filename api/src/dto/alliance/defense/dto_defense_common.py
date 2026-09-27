import uuid

from pydantic import BaseModel, Field

from src.game_types import DEFENSE_NAME_MAX_LENGTH


class Quota(BaseModel):
    used: int
    limit: int


class DefenseNameRequest(BaseModel):
    name: str = Field(min_length=1, max_length=DEFENSE_NAME_MAX_LENGTH)


class ChampionFields(BaseModel):
    champion_id: uuid.UUID
    champion_name: str
    champion_alias: str | None = None
    champion_class: str
    champion_image_url: str | None = None

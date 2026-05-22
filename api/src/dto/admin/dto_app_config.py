import uuid
from typing import Optional
from pydantic import BaseModel


class AppConfigResponse(BaseModel):
    current_season_id: Optional[uuid.UUID]
    off_season_big_thing: bool


class SetCurrentSeasonRequest(BaseModel):
    season_id: Optional[uuid.UUID]


class SetOffSeasonBigThingRequest(BaseModel):
    enabled: bool

import uuid
from datetime import datetime

from pydantic import BaseModel


class AscensionRequestCreate(BaseModel):
    champion_id: uuid.UUID


class AscensionRequestResponse(BaseModel):
    id: uuid.UUID
    champion_id: uuid.UUID
    champion_name: str
    image_url: str | None
    requester_login: str
    created_at: datetime

import uuid

from pydantic import BaseModel, Field

from src.game_types import NodeNumber


class ImportRow(BaseModel):
    champion_id: uuid.UUID
    defender_champion_id: uuid.UUID
    node_number: NodeNumber
    season_name: str  # e.g. "S42" or "42" — resolved server-side
    ko_count: int = Field(default=0, ge=0)


class FightRecordImportRequest(BaseModel):
    rows: list[ImportRow] = Field(min_length=1)


class FightRecordImportResponse(BaseModel):
    imported: int
    skipped: int = 0

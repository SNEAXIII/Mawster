import uuid

from pydantic import BaseModel, Field


class ImportRow(BaseModel):
    champion_id: uuid.UUID
    defender_champion_id: uuid.UUID
    node_number: int = Field(ge=1, le=50)
    season_name: str  # e.g. "S42" or "42" — resolved server-side
    ko_count: int = Field(default=0, ge=0)


class FightRecordImportRequest(BaseModel):
    rows: list[ImportRow] = Field(min_length=1)


class FightRecordImportResponse(BaseModel):
    imported: int
    skipped: int = 0

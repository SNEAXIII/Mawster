import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from src.enums.NoteReportStatus import NoteReportStatus


class NoteReportCreateRequest(BaseModel):
    reason: Optional[str] = Field(default=None, max_length=500)


class NoteRevisionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    content: str
    edited_by_pseudo: Optional[str] = None
    edited_at: datetime


class NoteReportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    note_id: uuid.UUID
    alliance_id: uuid.UUID
    alliance_name: Optional[str] = None
    battlegroup: int
    node_number: int
    note_content: str
    reporter_pseudo: Optional[str] = None
    reason: Optional[str] = None
    status: NoteReportStatus
    created_at: datetime


class PaginatedNoteReports(BaseModel):
    items: List[NoteReportResponse]
    total: int
    page: int
    size: int
    pages: int


class ReportResolveRequest(BaseModel):
    action: str = Field(..., pattern="^(delete|dismiss)$")


class MuteCreateRequest(BaseModel):
    reason: str = Field(..., min_length=1, max_length=500)
    expires_at: Optional[datetime] = None


class MuteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    user_login: Optional[str] = None
    reason: str
    created_at: datetime
    expires_at: Optional[datetime] = None
    lifted_at: Optional[datetime] = None


class WarnCreateRequest(BaseModel):
    reason: str = Field(..., min_length=1, max_length=500)


class WarnResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    user_login: Optional[str] = None
    reason: str
    created_at: datetime

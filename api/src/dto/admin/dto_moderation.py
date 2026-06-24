import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from src.enums.NoteReportStatus import NoteReportStatus
from src.utils.sanitize import sanitize_text


def _sanitize_required(value):
    return sanitize_text(value) if isinstance(value, str) else value


def _sanitize_optional(value):
    if not isinstance(value, str):
        return value
    cleaned = sanitize_text(value)
    return cleaned or None


class NoteReportCreateRequest(BaseModel):
    reason: Optional[str] = Field(default=None, max_length=500)

    _clean_reason = field_validator("reason", mode="before")(_sanitize_optional)


class NoteRevisionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    content: str
    edited_by_user_id: Optional[uuid.UUID] = None
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

    _clean_reason = field_validator("reason", mode="before")(_sanitize_required)


class MuteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    user_login: Optional[str] = None
    reason: str
    created_at: datetime
    expires_at: Optional[datetime] = None
    lifted_at: Optional[datetime] = None
    muted_by_login: Optional[str] = None


class WarnCreateRequest(BaseModel):
    reason: str = Field(..., min_length=1, max_length=500)

    _clean_reason = field_validator("reason", mode="before")(_sanitize_required)


class WarnResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    user_login: Optional[str] = None
    reason: str
    created_at: datetime
    warned_by_login: Optional[str] = None

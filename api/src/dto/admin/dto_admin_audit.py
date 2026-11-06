import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel

from src.enums.Roles import Roles

AuditResult = Literal["success", "refused", "error"]
PurgeScope = Literal["anonymous", "admins"]


class AuditEntryResponse(BaseModel):
    id: uuid.UUID
    created_at: datetime
    user_id: uuid.UUID | None = None
    user_login: str | None = None
    role: Roles | None = None
    method: str
    route: str
    status_code: int
    result: AuditResult
    details: dict[str, Any] | None = None


class PaginatedAuditEntries(BaseModel):
    items: list[AuditEntryResponse]
    total: int
    page: int
    size: int
    pages: int


class AuditEndpointFilter(BaseModel):
    method: str
    route: str


class AuditRouterFilter(BaseModel):
    name: str
    endpoints: list[AuditEndpointFilter]


class AuditAccountFilter(BaseModel):
    id: uuid.UUID
    login: str


class AuditFiltersResponse(BaseModel):
    routers: list[AuditRouterFilter]
    accounts: list[AuditAccountFilter]


class PurgeResponse(BaseModel):
    deleted: int

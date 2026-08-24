"""Admin read-only endpoints behind the AI-import dashboard."""

import uuid
from typing import Literal

from fastapi import APIRouter, Depends, Query

from src.dto.admin.dto_vision_stats import (
    PaginatedVisionImports,
    PaginatedVisionUserStats,
    VisionStatsResponse,
)
from src.models.VisionImport import VisionImportStatus
from src.services.admin.VisionStatsService import VisionStatsService
from src.services.auth.AuthService import AuthService
from src.utils.db import SessionDep

vision_stats_controller = APIRouter(
    prefix="/admin/vision",
    tags=["Vision Stats"],
    dependencies=[Depends(AuthService.require_admin)],
)

# 0 is "all time"; anything else is a rolling window of whole UTC days.
DaysQuery = Query(default=30, ge=0, le=365)


@vision_stats_controller.get("/stats", response_model=VisionStatsResponse)
async def get_vision_stats(session: SessionDep, days: int = DaysQuery):
    """Volume, outcome and model-quality counters over one window."""
    return await VisionStatsService.get_stats(session, days=days)


@vision_stats_controller.get("/users", response_model=PaginatedVisionUserStats)
async def get_vision_user_stats(
    session: SessionDep,
    days: int = DaysQuery,
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
    sort_by: Literal[
        "imports_total",
        "imports_confirmed",
        "imports_cancelled",
        "imports_failed",
        "screens_total",
        "last_import_at",
    ] = Query(default="imports_total"),
    sort_order: str = Query(default="desc", pattern="^(asc|desc)$"),
):
    """Who runs AI imports, and how those imports end up."""
    return await VisionStatsService.get_user_stats(
        session, days=days, page=page, size=size, sort_by=sort_by, sort_order=sort_order
    )


@vision_stats_controller.get("/imports", response_model=PaginatedVisionImports)
async def get_vision_imports(
    session: SessionDep,
    days: int = DaysQuery,
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
    status: VisionImportStatus | None = Query(default=None),
    user_id: uuid.UUID | None = Query(default=None),
):
    """The import log itself, newest first — the drill-down behind the charts."""
    return await VisionStatsService.get_recent_imports(
        session, days=days, page=page, size=size, status=status, user_id=user_id
    )

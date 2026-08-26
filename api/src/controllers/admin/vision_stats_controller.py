"""Admin read-only endpoints behind the AI-import dashboard."""

import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query

from src.dto.admin.dto_vision_stats import (
    PaginatedVisionImports,
    PaginatedVisionUserStats,
    VisionStatsResponse,
)
from src.models.vision.VisionImport import VisionImportStatus
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
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=100)] = 20,
    sort_by: Annotated[
        Literal[
            "imports_total",
            "imports_confirmed",
            "imports_cancelled",
            "imports_failed",
            "screens_total",
            "last_import_at",
        ],
        Query(),
    ] = "imports_total",
    sort_order: Annotated[str, Query(pattern="^(asc|desc)$")] = "desc",
):
    """Who runs AI imports, and how those imports end up."""
    return await VisionStatsService.get_user_stats(
        session, days=days, page=page, size=size, sort_by=sort_by, sort_order=sort_order
    )


@vision_stats_controller.get("/imports", response_model=PaginatedVisionImports)
async def get_vision_imports(
    session: SessionDep,
    days: int = DaysQuery,
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=100)] = 20,
    status: Annotated[VisionImportStatus | None, Query()] = None,
    user_id: Annotated[uuid.UUID | None, Query()] = None,
):
    """The import log itself, newest first — the drill-down behind the charts."""
    return await VisionStatsService.get_recent_imports(
        session, days=days, page=page, size=size, status=status, user_id=user_id
    )

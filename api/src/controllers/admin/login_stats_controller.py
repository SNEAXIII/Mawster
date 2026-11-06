"""Admin read-only endpoint behind the Login activity tab."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from src.dto.admin.dto_login_stats import LoginStatsResponse
from src.enums.LoginEventKind import LoginEventKind
from src.services.admin.LoginStatsService import LoginStatsService
from src.services.auth.AuthService import AuthService
from src.utils.audited_route import AuditedRoute
from src.utils.db import SessionDep

login_stats_controller = APIRouter(
    prefix="/admin/logins",
    tags=["Login Stats"],
    route_class=AuditedRoute,
    dependencies=[Depends(AuthService.require_admin)],
)

# Same bounds as the vision dashboard; 0 is "all time".
DaysQuery = Query(default=365, ge=0, le=365)


@login_stats_controller.get("/stats", response_model=LoginStatsResponse)
async def get_login_stats(
    session: SessionDep,
    days: int = DaysQuery,
    tz: Annotated[str, Query()] = "UTC",
    kind: Annotated[LoginEventKind | None, Query()] = None,
):
    """Distinct Accounts and Login events by month, weekday and hour, in the caller's time zone."""
    return await LoginStatsService.get_stats(session, days=days, tz=tz, kind=kind)

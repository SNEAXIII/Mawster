"""Admin read and purge endpoints behind the Audit tab, super admin only."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request
from fastapi.routing import iter_route_contexts
from pydantic import AwareDatetime

from src.dto.admin.dto_admin_audit import (
    AuditFiltersResponse,
    AuditResult,
    AuditRouterFilter,
    PaginatedAuditEntries,
    PurgeResponse,
    PurgeScope,
)
from src.services.admin.AdminAuditService import AdminAuditService
from src.services.auth.AuthService import AuthService
from src.utils.audited_route import AuditedRoute
from src.utils.db import SessionDep

admin_audit_controller = APIRouter(
    prefix="/admin/audit-entries",
    tags=["Admin Audit"],
    route_class=AuditedRoute,
    dependencies=[Depends(AuthService.require_admin), Depends(AuthService.require_super_admin)],
)


def _audited_routes(request: Request) -> dict[str, list[str]]:
    """Router name (its first tag) to the route templates it serves, audited routes only."""
    routers: dict[str, set[str]] = {}
    for context in iter_route_contexts(request.app.routes):
        route = context.original_route
        if isinstance(route, AuditedRoute) and route.tags:
            routers.setdefault(route.tags[0], set()).add(route.path)
    return {name: sorted(paths) for name, paths in routers.items()}


@admin_audit_controller.get("", response_model=PaginatedAuditEntries)
async def list_audit_entries(
    request: Request,
    session: SessionDep,
    router: str | None = None,
    route: Annotated[str | None, Query()] = None,
    method: str | None = None,
    result: AuditResult | None = None,
    user_id: uuid.UUID | None = None,
    date_from: AwareDatetime | None = None,
    date_to: AwareDatetime | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=100)] = 20,
):
    routes = None
    if router is not None:
        routes = _audited_routes(request).get(router, [])
    if route is not None:
        routes = [route] if routes is None or route in routes else []
    return await AdminAuditService.list_entries(
        session,
        routes=routes,
        method=method,
        result=result,
        user_id=user_id,
        date_from=date_from,
        date_to=date_to,
        page=page,
        size=size,
    )


@admin_audit_controller.get("/filters", response_model=AuditFiltersResponse)
async def get_audit_filters(request: Request, session: SessionDep):
    routers = [
        AuditRouterFilter(name=name, routes=paths)
        for name, paths in sorted(_audited_routes(request).items())
    ]
    accounts = await AdminAuditService.list_accounts(session)
    return AuditFiltersResponse(routers=routers, accounts=accounts)


@admin_audit_controller.delete("", response_model=PurgeResponse)
async def purge_audit_entries(
    session: SessionDep,
    before: AwareDatetime,
    scope: PurgeScope,
):
    deleted = await AdminAuditService.purge(session, before=before, scope=scope)
    return PurgeResponse(deleted=deleted)

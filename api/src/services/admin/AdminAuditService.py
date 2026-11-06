import asyncio
import json
import logging
import math
import uuid
from contextlib import aclosing
from datetime import datetime
from typing import Any

from fastapi import Request, Response
from fastapi.routing import APIRoute
from sqlmodel import and_, col, delete, func, or_, select
from starlette.requests import ClientDisconnect

from src.dto.admin.dto_admin_audit import (
    AuditAccountFilter,
    AuditEntryResponse,
    AuditResult,
    PaginatedAuditEntries,
    PurgeScope,
)
from src.enums.Roles import Roles
from src.models import User
from src.models.user.AdminAuditEntry import AdminAuditEntry
from src.utils.db import get_audit_session, get_session

logger = logging.getLogger(__name__)

MAX_DETAILS_BYTES = 8 * 1024
MAX_BODY_RAW_BYTES = 2048
BODY_READ_TIMEOUT_SECONDS = 1
REFUSED_STATUSES = (401, 403)


def result_of(status_code: int) -> AuditResult:
    if status_code < 400:
        return "success"
    return "refused" if status_code in REFUSED_STATUSES else "error"


def _result_clause(result: AuditResult):
    status = col(AdminAuditEntry.status_code)
    if result == "success":
        return status < 400
    if result == "refused":
        return status.in_(REFUSED_STATUSES)
    return and_(status >= 400, status.not_in(REFUSED_STATUSES))


class AdminAuditService:
    @classmethod
    async def record(
        cls, request: Request, route: APIRoute, status_code: int, response: Response | None = None
    ) -> None:
        if request.method == "GET" and status_code < 400:
            return
        try:
            user_id, role = getattr(request.state, "audit_user", (None, None))
            entry = AdminAuditEntry(
                user_id=user_id,
                role=role,
                method=request.method,
                route=route.path,
                status_code=status_code,
                details=await cls._details(request, route, response),
            )
            # Its own session, so the entry survives a rollback of the audited action.
            provider = request.app.dependency_overrides.get(get_session, get_audit_session)
            async with aclosing(provider()) as sessions:
                session = await anext(sessions)
                session.add(entry)
                await session.commit()
        except Exception:
            logger.exception("Admin audit entry lost: %s %s", request.method, route.path)

    @classmethod
    async def _details(
        cls, request: Request, route: APIRoute, response: Response | None
    ) -> dict[str, Any] | None:
        if not getattr(request.state, "audit_is_admin", False):
            return None
        details: dict[str, Any] = {
            "path": dict(request.path_params),
            "query": dict(request.query_params),
        }
        response_id = cls._response_id(response)
        if response_id is not None:
            details["response_id"] = response_id
        try:
            details |= await cls._body(request, route)
            size = len(json.dumps(details, ensure_ascii=False, allow_nan=False).encode())
            if size <= MAX_DETAILS_BYTES:
                return details
        except ValueError, TypeError:
            pass  # A lone surrogate or NaN would fail the write itself.
        # body_raw stays: padding the rest must not hide a payload, and it is too short to overflow.
        kept = {"body_raw": details["body_raw"]} if "body_raw" in details else {}
        return {"truncated": True} | kept

    @classmethod
    async def _body(cls, request: Request, route: APIRoute) -> dict[str, Any]:
        """`body` holds what the route's DTO accepts, `body_raw` keeps a suspicious payload as
        text: outside fields, a refused or unparsable body. A string cannot break json_valid.
        """
        try:
            # Unread on a route without a body model: a body never sent must not hold the response.
            data = await asyncio.wait_for(request.body(), timeout=BODY_READ_TIMEOUT_SECONDS)
        except ClientDisconnect, TimeoutError:
            return {}
        if not data:
            return {}
        try:
            parsed = json.loads(data)
        except ValueError, RecursionError:
            return {"body_raw": cls._cut(data.decode(errors="replace"))}
        raw = {"body_raw": cls._raw_text(parsed, data)}
        if route.body_field is None:
            return raw
        validated, errors = route.body_field.validate(parsed)
        if errors:
            return ({"body": {"count": len(parsed)}} | raw) if isinstance(parsed, list) else raw
        body = route.body_field.serialize(validated)
        if isinstance(parsed, list):
            outside_dto = any(map(cls._outside_dto, parsed, body, strict=True))
            return {"body": {"count": len(parsed)}} | (raw if outside_dto else {})
        outside_dto = cls._outside_dto(parsed, body)
        if isinstance(body, dict):
            body.pop("reason", None)
        return {"body": body} | (raw if outside_dto else {})

    @staticmethod
    def _outside_dto(parsed: Any, dumped: Any) -> bool:
        return isinstance(dumped, dict) and bool(parsed.keys() - dumped.keys())

    @classmethod
    def _raw_text(cls, parsed: Any, data: bytes) -> str:
        kept = parsed
        if isinstance(parsed, dict):
            kept = {key: value for key, value in parsed.items() if key != "reason"}
        try:
            # ensure_ascii stays on: it escapes a lone surrogate, which .encode() would refuse.
            text = json.dumps(kept)
        except ValueError, TypeError, RecursionError:
            text = data.decode(errors="replace")
        return cls._cut(text)

    @staticmethod
    def _cut(text: str) -> str:
        return text.encode()[:MAX_BODY_RAW_BYTES].decode(errors="ignore")

    @staticmethod
    def _response_id(response: Response | None) -> Any:
        try:
            payload = json.loads(response.body)
        except AttributeError, TypeError, ValueError:
            return None  # No response, a streamed one, or not JSON.
        return payload.get("id") if isinstance(payload, dict) else None

    @classmethod
    async def list_entries(
        cls,
        session,
        *,
        routes: list[str] | None,
        method: str | None,
        result: AuditResult | None,
        user_id: uuid.UUID | None,
        date_from: datetime | None,
        date_to: datetime | None,
        page: int,
        size: int,
    ) -> PaginatedAuditEntries:
        conds = []
        if routes is not None:
            conds.append(col(AdminAuditEntry.route).in_(routes))
        if method is not None:
            conds.append(col(AdminAuditEntry.method) == method)
        if result is not None:
            conds.append(_result_clause(result))
        if user_id is not None:
            conds.append(col(AdminAuditEntry.user_id) == user_id)
        if date_from is not None:
            conds.append(col(AdminAuditEntry.created_at) >= date_from)
        if date_to is not None:
            conds.append(col(AdminAuditEntry.created_at) <= date_to)

        base = (
            select(AdminAuditEntry, User.login)
            .outerjoin(User, col(AdminAuditEntry.user_id) == User.id)
            .where(*conds)
        )
        count = select(func.count()).select_from(AdminAuditEntry).where(*conds)
        total = (await session.exec(count)).one()
        rows = (
            await session.exec(
                base.order_by(
                    col(AdminAuditEntry.created_at).desc(), col(AdminAuditEntry.id).desc()
                )
                .offset((page - 1) * size)
                .limit(size)
            )
        ).all()

        items = [
            AuditEntryResponse(
                id=entry.id,
                created_at=entry.created_at,
                user_id=entry.user_id,
                user_login=login,
                role=entry.role,
                method=entry.method,
                route=entry.route,
                status_code=entry.status_code,
                result=result_of(entry.status_code),
                details=entry.details,
            )
            for entry, login in rows
        ]
        return PaginatedAuditEntries(
            items=items,
            total=total,
            page=page,
            size=size,
            pages=max(1, math.ceil(total / size)),
        )

    @classmethod
    async def list_accounts(cls, session) -> list[AuditAccountFilter]:
        rows = (
            await session.exec(
                select(User.id, User.login)
                .join(AdminAuditEntry, col(AdminAuditEntry.user_id) == User.id)
                .distinct()
                .order_by(User.login)
            )
        ).all()
        return [AuditAccountFilter(id=user_id, login=login) for user_id, login in rows]

    # ponytail: manual purge, one unbounded DELETE per scope; a scheduled retention job
    # replaces it once the table grows.
    @classmethod
    async def purge(cls, session, *, before: datetime, scope: PurgeScope) -> int:
        role = col(AdminAuditEntry.role)
        if scope == "anonymous":
            scoped = or_(role.is_(None), role == Roles.USER)
        else:
            scoped = role.in_([Roles.ADMIN, Roles.SUPER_ADMIN])
        deleted = await session.exec(
            delete(AdminAuditEntry).where(col(AdminAuditEntry.created_at) < before, scoped)
        )
        await session.commit()
        return deleted.rowcount

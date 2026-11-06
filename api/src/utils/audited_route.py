from collections.abc import Callable, Coroutine
from typing import Any

from fastapi import Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.routing import APIRoute
from starlette import status
from starlette.exceptions import HTTPException

from src.services.admin.AdminAuditService import AdminAuditService


def _status_of(exc: Exception) -> int:
    if isinstance(exc, HTTPException):
        return exc.status_code
    if isinstance(exc, RequestValidationError):
        return status.HTTP_422_UNPROCESSABLE_CONTENT
    return status.HTTP_500_INTERNAL_SERVER_ERROR


class AuditedRoute(APIRoute):
    """Writes an Admin Audit Entry per call, 401/403 included: they are raised while the
    dependencies resolve, inside this handler, before any service runs.
    """

    def get_route_handler(self) -> Callable[[Request], Coroutine[Any, Any, Response]]:
        handler = super().get_route_handler()

        # ponytail: each 401 writes a row while `limiter` is disabled, and past the audit pool's
        # capacity an entry is lost and logged; enable it (utils/rate_limiter.py) to bound both.
        async def audited_handler(request: Request) -> Response:
            try:
                response = await handler(request)
            except Exception as exc:
                await AdminAuditService.record(request, self, _status_of(exc))
                raise
            await AdminAuditService.record(request, self, response.status_code, response)
            return response

        return audited_handler

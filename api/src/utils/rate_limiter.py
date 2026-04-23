from slowapi import Limiter
from starlette.requests import Request

from src.security import IS_PROD


def _get_real_ip(request: Request) -> str:
    # Traefik sets X-Forwarded-For; take the leftmost (original client IP)
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


limiter = Limiter(key_func=_get_real_ip, enabled=IS_PROD)

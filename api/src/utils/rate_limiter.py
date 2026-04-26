from slowapi import Limiter
from starlette.requests import Request


def _get_real_ip(request: Request) -> str:
    # Traefik sets X-Forwarded-For; take the leftmost (original client IP)
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


# TODO: fix rate limiting — disabled until X-Forwarded-For handling is validated
limiter = Limiter(key_func=_get_real_ip, enabled=False)

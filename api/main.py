from time import perf_counter
from pathlib import Path
import asyncio
import logging

from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import _StreamingResponse
from src.Messages.validators_messages import VALIDATION_ERROR
from src.controllers import routers
from src.security import IS_PROD, IS_TESTING
from starlette import status
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from prometheus_fastapi_instrumentator import Instrumentator
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST

from src.security.secrets import SECRET
from src.utils.logging_config import setup_logging
from src.utils.rate_limiter import limiter

# Initialize logging before anything else
setup_logging(logging.INFO if IS_PROD else logging.DEBUG)
logger = logging.getLogger(__name__)

if not IS_PROD:
    logger.info("Starting Mawster API — database: %s", SECRET.MARIADB_DATABASE)

app = FastAPI(title="Mawster", version="1.0.0")
Instrumentator().instrument(app)

# Rate limiter (utilise l'IP du client — X-Forwarded-For si disponible, sinon connexion directe)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS — origines définies dans api.env (ALLOWED_ORIGINS), jamais "*" en prod
_cors_origins = [origin.strip() for origin in SECRET.ALLOWED_ORIGINS.split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
for router in routers:
    app.include_router(router)

if not IS_PROD:
    from src.controllers.dev_controller import dev_controller

    app.include_router(dev_controller)
    logger.info("Dev controller enabled (MODE != prod)")

if IS_TESTING:
    import hashlib
    from src.services.DiscordAuthService import DiscordAuthService, DISCORD_TOKEN_INVALID_EXCEPTION

    async def _fake_verify(cls, access_token: str) -> dict:
        if not access_token:
            raise DISCORD_TOKEN_INVALID_EXCEPTION
        token_hash = hashlib.sha256(access_token.encode()).hexdigest()[:16]
        random = token_hash[:8]
        return {
            "id": token_hash,
            "username": f"test_{random}",
            "email": f"{random}@test.com",
        }

    DiscordAuthService.verify_discord_token = classmethod(_fake_verify)
    logger.info("Testing mode: Discord verification is mocked")

# Mount static files for champion images
static_dir = Path(__file__).resolve().parent / "static"
# static_dir.mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")


@app.get("/metrics", include_in_schema=False)
async def metrics():
    data = await asyncio.get_event_loop().run_in_executor(None, generate_latest)
    return Response(content=data, media_type=CONTENT_TYPE_LATEST)


def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    openapi_schema = get_openapi(
        title="Mawster",
        version="1.0.0",
        description="Documentation for Mawster api backend",
        routes=app.routes,
    )
    app.openapi_schema = openapi_schema
    return app.openapi_schema


app.openapi = custom_openapi


@app.middleware("http")
async def check_user_role(
    request: Request,
    next_function,
):
    uri = request.url.path.rstrip("/")
    method = request.method
    start_time = perf_counter()
    response: _StreamingResponse = await next_function(request)
    process_time = perf_counter() - start_time
    if not IS_PROD:
        response.headers["X-Process-Time"] = str(process_time)
    if not uri.startswith("/static"):
        logger.debug("%s %s", method, uri)
        logger.info("%s %s → %s (%.3fs)", method, uri, response.status_code, process_time)
    return response


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    """Override default validation error for a better structure"""
    errors_dict = {}
    for error in exc.errors():
        location_list = error.get("loc")
        if not location_list:
            raise ValueError(f"loc parameter is not correct:\n {error}")
        location = location_list[-1]
        error_type = error.get("type").capitalize().replace("_", " ")
        error_message = error.get("msg").removeprefix(f"{error_type}, ")
        errors_dict[location] = {"type": error.get("type"), "message": error_message}
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        content={"message": VALIDATION_ERROR, "errors": errors_dict},
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc):
    return JSONResponse(
        status_code=exc.status_code,
        content={"message": exc.detail},
    )


@app.get("/")
async def test():
    return {"hello": "world"}

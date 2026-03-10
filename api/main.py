from time import perf_counter
from pathlib import Path
import logging

from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import _StreamingResponse
from src.Messages.validators_messages import VALIDATION_ERROR
from src.controllers.admin_controller import admin_controller
from src.controllers.auth_controller import auth_controller
from src.controllers.user_controller import user_controller
from src.controllers.game_account_controller import game_account_controller
from src.controllers.alliance_controller import alliance_controller
from src.controllers.champion_user_controller import champion_user_controller
from src.controllers.champion_controller import champion_controller, champion_read_controller
from src.controllers.defense_controller import defense_controller
from src.security import IS_PROD, IS_TESTING
from starlette import status
from starlette.requests import Request
from starlette.responses import JSONResponse

from src.security.secrets import SECRET
from src.utils.logging_config import setup_logging

# Initialize logging before anything else
setup_logging()
logger = logging.getLogger(__name__)

if not IS_PROD:
    logger.info("Starting Mawster API — database: %s", SECRET.MARIADB_DATABASE)

app = FastAPI(title="Mawster", version="1.0.0")

# Rate limiter (utilise l'IP du client — X-Forwarded-For si disponible, sinon connexion directe)
# limiter = Limiter(key_func=get_remote_address)
# app.state.limiter = limiter
# app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS — origines définies dans api.env (ALLOWED_ORIGINS), jamais "*" en prod
_cors_origins = [origin.strip() for origin in SECRET.ALLOWED_ORIGINS.split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(admin_controller)
app.include_router(auth_controller)
app.include_router(user_controller)
app.include_router(game_account_controller)
app.include_router(alliance_controller)
app.include_router(champion_user_controller)
app.include_router(champion_controller)
app.include_router(champion_read_controller)
app.include_router(defense_controller)

if not IS_PROD:
    from src.controllers.dev_controller import dev_controller
    app.include_router(dev_controller)
    logger.info("Dev controller enabled (MODE != prod)")

if IS_TESTING:
    import hashlib
    from src.services.DiscordAuthService import DiscordAuthService, DISCORD_TOKEN_INVALID_EXCEPTION

    _original_verify = DiscordAuthService.verify_discord_token

    async def _fake_verify(cls, access_token: str) -> dict:
        if not access_token:
            raise DISCORD_TOKEN_INVALID_EXCEPTION
        token_hash = hashlib.sha256(access_token.encode()).hexdigest()[:16]
        random =token_hash[:8]
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
    logger.debug("%s %s", method, uri)
    start_time = perf_counter()
    response: _StreamingResponse = await next_function(request)
    process_time = perf_counter() - start_time
    if not IS_PROD:
        response.headers["X-Process-Time"] = str(process_time)
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
        status_code=status.HTTP_400_BAD_REQUEST,
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

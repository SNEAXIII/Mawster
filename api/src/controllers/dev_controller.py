"""Dev-only controller — all routes are disabled when MODE=prod."""
import importlib.util
import logging
import os
import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlmodel import select, SQLModel
from starlette import status as http_status

from src.dto.dto_token import LoginResponse, TokenBody
from src.dto.dto_utilisateurs import UserProfile
from src.enums.Roles import Roles
from src.models import User, GameAccount
from src.security.secrets import SECRET
from src.services.JWTService import JWTService
from src.services.UserService import UserService
from src.utils.db import SessionDep
from src.utils.logging_config import audit_log

logger = logging.getLogger(__name__)

dev_controller = APIRouter(
    prefix="/dev",
    tags=["Dev"],
)


# ── DTOs ──────────────────────────────────────────────────────────────────────


class DevLoginRequest(BaseModel):
    """Select a user by ID for dev login (no Discord needed)."""
    user_id: uuid.UUID

class DevJoinAllianceRequest(BaseModel):
    """Request body for joining an alliance as a dev user."""
    game_account_id: uuid.UUID
    alliance_id: uuid.UUID

class DevUser(BaseModel):
    """Minimal user info for the dev user picker."""
    id: uuid.UUID
    login: str
    email: str
    role: str


class PromoteRequest(BaseModel):
    user_id: uuid.UUID
    role: str = Roles.ADMIN

# ── Endpoints ─────────────────────────────────────────────────────────────────


@dev_controller.post("/session", response_model=UserProfile)
async def read_users_me_with_token(body: TokenBody, session: SessionDep):
    """Accept a token in the request body, decode it and return the corresponding user profile.

    This endpoint is used by tests which POST a token payload instead of using Authorization header.
    """
    data = JWTService.decode_jwt(body.token)
    user_id = data.get("user_id")
    user = await UserService.get_user_by_id_with_validity_check(session, user_id)
    return user


@dev_controller.get("/users", response_model=list[DevUser])
async def dev_list_users(session: SessionDep):
    """List all users for the dev login picker."""
    result = await session.exec(select(User))
    users = result.all()
    return [
        DevUser(id=str(u.id), login=u.login, email=u.email, role=u.role)
        for u in users
    ]


@dev_controller.post("/login", status_code=200)
async def dev_login(body: DevLoginRequest, session: SessionDep) -> LoginResponse:
    """Authenticate as any user without Discord."""
    user = await UserService.get_user_by_id_with_validity_check(session, str(body.user_id))
    access_token = JWTService.create_access_token(user)
    refresh_token = JWTService.create_refresh_token(user)

    audit_log("auth.dev_login", user_id=str(user.id), detail="method=dev")
    logger.warning("DEV LOGIN — user: %s (%s)", user.login, user.email)

    return LoginResponse(
        token_type="bearer",
        access_token=access_token,
        refresh_token=refresh_token,
    )


@dev_controller.post("/truncate", status_code=200)
async def truncate_database(session: SessionDep):
    """Truncate all tables in the database. For testing purposes only."""
    await session.execute(text("SET FOREIGN_KEY_CHECKS = 0"))
    for table in reversed(SQLModel.metadata.sorted_tables):
        await session.execute(text(f"TRUNCATE TABLE `{table.name}`"))
    await session.execute(text("SET FOREIGN_KEY_CHECKS = 1"))
    await session.commit()
    return {"message": "All tables truncated"}


@dev_controller.post("/fixtures", status_code=200)
async def run_fixtures(session: SessionDep):
    """Truncate all tables then run every fixture script in /fixtures/. Testing only."""
    await session.execute(text("SET FOREIGN_KEY_CHECKS = 0"))
    for table in reversed(SQLModel.metadata.sorted_tables):
        await session.execute(text(f"TRUNCATE TABLE `{table.name}`"))
    await session.execute(text("SET FOREIGN_KEY_CHECKS = 1"))
    await session.commit()

    fixtures_dir = Path(__file__).resolve().parent.parent.parent / "fixtures"
    results = {}
    for fixture_file in sorted(fixtures_dir.glob("*.py")):
        if fixture_file.stem.startswith("_"):
            continue
        spec = importlib.util.spec_from_file_location(f"fixtures.{fixture_file.stem}", fixture_file)
        module = importlib.util.module_from_spec(spec)  # type: ignore[arg-type]
        spec.loader.exec_module(module)  # type: ignore[union-attr]
        if hasattr(module, "run"):
            results[fixture_file.stem] = await module.run(session)

    return {"message": "Fixtures loaded", "results": results}


@dev_controller.post("/force-join-alliance", status_code=200)
async def force_join_alliance(body: DevJoinAllianceRequest, session: SessionDep):
    """Force a game account to join an alliance, bypassing all checks. For testing purposes only."""
    game_account = await session.get(GameAccount, body.game_account_id)
    if not game_account:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="Game account not found"
        )
    game_account.alliance_id = body.alliance_id
    session.add(game_account)
    await session.commit()
    await session.refresh(game_account)
    return {"message": f"Game account {game_account.game_pseudo} forced to join alliance {body.alliance_id}", "game_account_id": str(game_account.id)}


@dev_controller.post("/promote", status_code=200)
async def promote_user(body: PromoteRequest, session: SessionDep):
    """Promote a user to a given role. For testing purposes only."""
    user = await UserService.get_user(session, body.user_id)
    if not user:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    user.role = body.role
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return {"message": f"User promoted to {body.role}", "user_id": str(user.id)}


class EnvInfo(BaseModel):
    """Non-sensitive environment info for debugging."""
    mode: str
    api_port: int
    db_host: str
    db_port: int
    db_name: str
    db_user: str


@dev_controller.get("/env-info", response_model=EnvInfo)
async def get_env_info():
    """Return non-sensitive environment configuration for debugging (test/dev mode only)."""
    return EnvInfo(
        mode=os.getenv("MODE", "dev"),
        api_port=SECRET.API_PORT,
        db_host=SECRET.MARIADB_HOST,
        db_port=SECRET.MARIADB_PORT,
        db_name=SECRET.MARIADB_DATABASE,
        db_user=SECRET.MARIADB_USER,
    )

"""Dev-only controller — all routes are disabled when MODE=prod."""
import logging
import uuid

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlmodel import select, SQLModel
from starlette import status as http_status

from src.dto.dto_token import LoginResponse, TokenBody
from src.dto.dto_utilisateurs import UserProfile
from src.enums.Roles import Roles
from src.models import User
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
    user_id: str


class DevUser(BaseModel):
    """Minimal user info for the dev user picker."""
    id: str
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
    user = await UserService.get_user_by_id_with_validity_check(session, body.user_id)
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


@dev_controller.post("/promote", status_code=200)
async def promote_user(body: PromoteRequest, session: SessionDep):
    """Promote a user to a given role. For testing purposes only."""
    user = await UserService.get_user(session, body.user_id)
    if not user:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="User not found")
    user.role = body.role
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return {"message": f"User promoted to {body.role}", "user_id": str(user.id)}

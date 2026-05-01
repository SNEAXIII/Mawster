"""Dev-only controller — all routes are disabled when MODE=prod."""

import importlib.util
import logging
import os
import uuid
from pathlib import Path
from typing import Literal
from fastapi import APIRouter, Form, HTTPException
from typing import Annotated
from pydantic import BaseModel
from sqlalchemy import text
from sqlmodel import select, SQLModel
from starlette import status as http_status

from src.dto.dto_token import LoginResponse, TokenBody
from src.dto.dto_utilisateurs import UserProfile
from src.enums.Roles import Roles
from src.models import User, GameAccount
from src.models.Champion import Champion
from src.models.ChampionUser import ChampionUser
from src.models.WarDefensePlacement import WarDefensePlacement
from src.models.Mastery import Mastery
from src.security.secrets import SECRET
from src.services.DiscordAuthService import DiscordAuthService
from src.services.GameAccountService import GameAccountService
from src.services.AllianceService import AllianceService
from src.services.JWTService import JWTService
from src.services.UserService import UserService
from src.utils.db import SessionDep

logger = logging.getLogger(__name__)

dev_controller = APIRouter(
    prefix="/dev",
    tags=["Dev"],
)


# ── DTOs ──────────────────────────────────────────────────────────────────────


class DevLoginRequest(BaseModel):
    """Select a user by ID for dev login (no Discord needed)."""

    user_id: uuid.UUID


class DevLoginByPseudoRequest(BaseModel):
    """Select a user by game pseudo for dev login (no Discord needed)."""

    game_pseudo: str


class DevJoinAllianceRequest(BaseModel):
    """Request body for joining an alliance as a dev user."""

    game_account_id: uuid.UUID
    alliance_id: uuid.UUID


class DevUser(BaseModel):
    """Minimal user info for the dev user picker."""

    id: uuid.UUID
    login: str
    email_hash: str | None
    role: str


class PromoteRequest(BaseModel):
    user_id: uuid.UUID
    role: str = Roles.ADMIN


class SetupAllianceSpec(BaseModel):
    name: str
    tag: str


class SetupUserSpec(BaseModel):
    discord_token: str
    role: str = "user"
    game_pseudo: str | None = None
    create_alliance: SetupAllianceSpec | None = None
    join_alliance_token: str | None = None
    battlegroup: int | None = None


class SetupUserResult(BaseModel):
    access_token: str
    refresh_token: str
    user_id: str
    login: str
    discord_id: str
    account_id: str | None = None
    alliance_id: str | None = None


class BatchSetupResponse(BaseModel):
    users: dict[str, SetupUserResult]


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
        DevUser(id=str(u.id), login=u.login, email_hash=u.email_hash, role=u.role) for u in users
    ]


@dev_controller.post("/login", status_code=200)
async def dev_login(body: DevLoginRequest, session: SessionDep) -> LoginResponse:
    """Authenticate as any user without Discord."""
    user = await UserService.get_user_by_id_with_validity_check(session, str(body.user_id))
    access_token = JWTService.create_access_token(user)
    refresh_token = JWTService.create_refresh_token(user)

    logger.warning("DEV LOGIN — user: %s", user.login)

    return LoginResponse(
        token_type="bearer",
        access_token=access_token,
        refresh_token=refresh_token,
    )


@dev_controller.post("/token", status_code=200)
async def dev_token(username: Annotated[str, Form()], session: SessionDep) -> LoginResponse:
    """OAuth2 password flow for Swagger UI — username = game_pseudo or Discord login."""
    game_account = (
        await session.exec(select(GameAccount).where(GameAccount.game_pseudo == username))
    ).first()
    if game_account:
        user = await UserService.get_user_by_id_with_validity_check(session, str(game_account.user_id))
    else:
        user = (await session.exec(select(User).where(User.login == username))).first()
        if not user:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND, detail="No game account or user found"
            )
    logger.warning("DEV TOKEN — username: %s / user: %s", username, user.login)
    return LoginResponse(
        token_type="bearer",
        access_token=JWTService.create_access_token(user),
        refresh_token=JWTService.create_refresh_token(user),
    )


@dev_controller.post("/login-by-pseudo", status_code=200)
async def dev_login_by_pseudo(body: DevLoginByPseudoRequest, session: SessionDep) -> LoginResponse:
    """Authenticate as any user by game pseudo without Discord."""
    game_account = (
        await session.exec(select(GameAccount).where(GameAccount.game_pseudo == body.game_pseudo))
    ).first()
    if not game_account:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND, detail="Game account not found"
        )
    user = await UserService.get_user_by_id_with_validity_check(session, str(game_account.user_id))
    access_token = JWTService.create_access_token(user)
    refresh_token = JWTService.create_refresh_token(user)
    logger.warning("DEV LOGIN BY PSEUDO — pseudo: %s / user: %s", body.game_pseudo, user.login)
    return LoginResponse(
        token_type="bearer", access_token=access_token, refresh_token=refresh_token
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
            status_code=http_status.HTTP_404_NOT_FOUND, detail="Game account not found"
        )
    game_account.alliance_id = body.alliance_id
    session.add(game_account)
    await session.commit()
    await session.refresh(game_account)
    return {
        "message": f"Game account {game_account.game_pseudo} forced to join alliance {body.alliance_id}",
        "game_account_id": str(game_account.id),
    }


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


@dev_controller.post("/batch-setup", response_model=BatchSetupResponse, status_code=200)
async def batch_setup(specs: list[SetupUserSpec], session: SessionDep):
    """Create multiple users with game accounts, alliances, and roles in a single request.

    Users are processed in order — you can reference an earlier user's alliance via
    join_alliance_token. Testing only.
    """
    results: dict[str, SetupUserResult] = {}

    for spec in specs:
        # 1. Register / get user via mock Discord auth
        discord_profile = await DiscordAuthService.verify_token(spec.discord_token)
        user = await DiscordAuthService.get_or_create_user(session, discord_profile)

        # 2. Set role if it differs
        if spec.role != user.role:
            user.role = spec.role
            session.add(user)
            await session.commit()
            await session.refresh(user)

        # 3. Issue fresh tokens (after role is set)
        access_token = JWTService.create_access_token(user)
        refresh_token = JWTService.create_refresh_token(user)

        account_id: str | None = None
        alliance_id: str | None = None

        # 4. Game account
        if spec.game_pseudo:
            acc = await GameAccountService.create_game_account(
                session, user.id, spec.game_pseudo, True
            )
            account_id = str(acc.id)

            # 5a. Create alliance
            if spec.create_alliance:
                alliance = await AllianceService.create_alliance(
                    session,
                    name=spec.create_alliance.name,
                    tag=spec.create_alliance.tag,
                    owner_id=acc.id,
                    current_user_id=user.id,
                )
                alliance_id = str(alliance.id)

            # 5b. Force-join another user's alliance
            elif spec.join_alliance_token:
                ref = results.get(spec.join_alliance_token)
                if ref and ref.alliance_id:
                    acc.alliance_id = uuid.UUID(ref.alliance_id)
                    session.add(acc)
                    await session.commit()
                    alliance_id = ref.alliance_id

            # 6. Assign battlegroup
            if spec.battlegroup is not None and alliance_id:
                await AllianceService.set_member_group(
                    session, uuid.UUID(alliance_id), acc.id, spec.battlegroup
                )

        results[spec.discord_token] = SetupUserResult(
            access_token=access_token,
            refresh_token=refresh_token,
            user_id=str(user.id),
            login=user.login,
            discord_id=user.discord_id,
            account_id=account_id,
            alliance_id=alliance_id,
        )

    return BatchSetupResponse(users=results)


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


class DevCreateMasteryRequest(BaseModel):
    name: str
    max_value: int
    order: int


@dev_controller.post("/masteries", status_code=201)
async def dev_create_mastery(body: DevCreateMasteryRequest, session: SessionDep):
    """Create a mastery definition. For testing purposes only."""
    mastery = Mastery(name=body.name, max_value=body.max_value, order=body.order)
    session.add(mastery)
    await session.commit()
    await session.refresh(mastery)
    return {
        "id": str(mastery.id),
        "name": mastery.name,
        "max_value": mastery.max_value,
        "order": mastery.order,
    }


class BulkFillWarAttackersRequest(BaseModel):
    war_id: uuid.UUID
    battlegroup: int
    game_account_id: uuid.UUID
    count: int


@dev_controller.post("/bulk-fill-war-attackers", status_code=200)
async def bulk_fill_war_attackers(body: BulkFillWarAttackersRequest, session: SessionDep):
    """Create N WarDefensePlacement rows with a dummy attacker assigned to the given account.

    Bypasses all war service validations. Testing only.
    """
    champion = (await session.exec(select(Champion).limit(1))).first()
    if not champion:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="No champion found")

    created = 0
    for node in range(1, body.count + 1):
        existing = (
            await session.exec(
                select(WarDefensePlacement).where(
                    WarDefensePlacement.war_id == body.war_id,
                    WarDefensePlacement.battlegroup == body.battlegroup,
                    WarDefensePlacement.node_number == node,
                )
            )
        ).first()

        cu = ChampionUser(
            game_account_id=body.game_account_id,
            champion_id=champion.id,
            stars=7,
            rank=3,
        )
        session.add(cu)
        await session.flush()

        if existing:
            existing.attacker_champion_user_id = cu.id
            session.add(existing)
        else:
            placement = WarDefensePlacement(
                war_id=body.war_id,
                battlegroup=body.battlegroup,
                node_number=node,
                champion_id=champion.id,
                stars=7,
                rank=3,
                attacker_champion_user_id=cu.id,
            )
            session.add(placement)
        created += 1

    await session.commit()
    return {"assigned": created}


class LogMarkerRequest(BaseModel):
    event: Literal["start", "end"]
    title: str  # full test title, e.g. "war > place defender > node 1"
    passed: bool | None = None  # None for start, True/False for end


@dev_controller.post("/log-marker", status_code=200)
async def log_test_marker(body: LogMarkerRequest):
    """Write a test boundary marker into the backend log. Testing only."""
    if body.event == "start":
        logger.info("===TEST_START=== %s", body.title)
    else:
        state = "PASS" if body.passed else "FAIL"
        logger.info("===TEST_END=== %s %s", body.title, state)
    return {"ok": True}

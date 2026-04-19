"""Integration tests for /dev endpoints — development utilities."""
import uuid

import pytest

from main import app
from src.enums.Roles import Roles
from src.services.JWTService import JWTService
from src.utils.db import get_session
from tests.integration.endpoints.setup.game_setup import (
    push_alliance_with_owner,
    push_game_account,
)
from tests.integration.endpoints.setup.user_setup import push_one_user
from tests.utils.utils_client import execute_get_request, execute_post_request
from tests.utils.utils_constant import USER_ID, USER_LOGIN, USER2_ID, GAME_PSEUDO
from tests.utils.utils_db import get_test_session

app.dependency_overrides[get_session] = get_test_session


# =========================================================================
# POST /dev/session
# =========================================================================


class TestDevSession:
    @pytest.mark.asyncio
    async def test_valid_token_returns_user_profile(self):
        await push_one_user()
        token = JWTService.create_token(
            {"user_id": str(USER_ID), "role": Roles.USER, "type": "access"}
        )
        response = await execute_post_request("/dev/session", {"token": token})
        assert response.status_code == 200
        body = response.json()
        assert body["login"] == USER_LOGIN


# =========================================================================
# GET /dev/users
# =========================================================================


class TestDevUsers:
    @pytest.mark.asyncio
    async def test_returns_all_users(self):
        await push_one_user()
        response = await execute_get_request("/dev/users")
        assert response.status_code == 200
        body = response.json()
        assert len(body) >= 1
        logins = [u["login"] for u in body]
        assert USER_LOGIN in logins

    @pytest.mark.asyncio
    async def test_empty_db_returns_empty_list(self, session):
        response = await execute_get_request("/dev/users")
        assert response.status_code == 200
        assert response.json() == []


# =========================================================================
# POST /dev/login
# =========================================================================


class TestDevLogin:
    @pytest.mark.asyncio
    async def test_returns_access_and_refresh_tokens(self):
        await push_one_user()
        response = await execute_post_request("/dev/login", {"user_id": str(USER_ID)})
        assert response.status_code == 200
        body = response.json()
        assert "access_token" in body
        assert "refresh_token" in body
        assert body["token_type"] == "bearer"

    @pytest.mark.asyncio
    async def test_unknown_user_returns_error(self, session):
        response = await execute_post_request(
            "/dev/login", {"user_id": str(uuid.uuid4())}
        )
        assert response.status_code >= 400

    @pytest.mark.asyncio
    async def test_invalid_uuid_returns_422(self, session):
        response = await execute_post_request("/dev/login", {"user_id": "not-a-uuid"})
        assert response.status_code == 422


# =========================================================================
# POST /dev/force-join-alliance
# =========================================================================


class TestDevForceJoinAlliance:
    @pytest.mark.asyncio
    async def test_force_join_assigns_alliance(self):
        alliance, _ = await push_alliance_with_owner()
        member_acc = await push_game_account(
            user_id=USER2_ID, game_pseudo="NewPlayer"
        )

        response = await execute_post_request(
            "/dev/force-join-alliance",
            {
                "game_account_id": str(member_acc.id),
                "alliance_id": str(alliance.id),
            },
        )
        assert response.status_code == 200
        body = response.json()
        assert "game_account_id" in body

    @pytest.mark.asyncio
    async def test_unknown_game_account_returns_404(self, session):
        response = await execute_post_request(
            "/dev/force-join-alliance",
            {
                "game_account_id": str(uuid.uuid4()),
                "alliance_id": str(uuid.uuid4()),
            },
        )
        assert response.status_code == 404


# =========================================================================
# POST /dev/promote
# =========================================================================


class TestDevPromote:
    @pytest.mark.asyncio
    async def test_promotes_user_to_given_role(self):
        await push_one_user()
        response = await execute_post_request(
            "/dev/promote",
            {"user_id": str(USER_ID), "role": Roles.ADMIN},
        )
        assert response.status_code == 200
        body = response.json()
        assert body["user_id"] == str(USER_ID)

    @pytest.mark.asyncio
    async def test_unknown_user_returns_404(self, session):
        response = await execute_post_request(
            "/dev/promote",
            {"user_id": str(uuid.uuid4()), "role": Roles.ADMIN},
        )
        assert response.status_code == 404


# =========================================================================
# POST /dev/batch-setup
# =========================================================================


class TestDevBatchSetup:
    @pytest.mark.asyncio
    async def test_creates_user_from_discord_token(self, session):
        response = await execute_post_request(
            "/dev/batch-setup",
            [{"discord_token": "fake_token_batch", "role": "user"}],
        )
        assert response.status_code == 200
        body = response.json()
        assert "users" in body
        assert "fake_token_batch" in body["users"]
        result = body["users"]["fake_token_batch"]
        assert result["login"] is not None
        assert result["access_token"] is not None

    @pytest.mark.asyncio
    async def test_creates_user_with_game_account(self, session):
        response = await execute_post_request(
            "/dev/batch-setup",
            [
                {
                    "discord_token": "fake_token_with_acc",
                    "role": "user",
                    "game_pseudo": GAME_PSEUDO,
                }
            ],
        )
        assert response.status_code == 200
        result = response.json()["users"]["fake_token_with_acc"]
        assert result["account_id"] is not None

    @pytest.mark.asyncio
    async def test_empty_token_returns_401(self, session):
        response = await execute_post_request(
            "/dev/batch-setup",
            [{"discord_token": "", "role": "user"}],
        )
        assert response.status_code == 401


# =========================================================================
# GET /dev/env-info
# =========================================================================


class TestDevEnvInfo:
    @pytest.mark.asyncio
    async def test_returns_env_fields(self, session):
        response = await execute_get_request("/dev/env-info")
        assert response.status_code == 200
        body = response.json()
        assert "mode" in body
        assert "api_port" in body
        assert "db_host" in body
        assert "db_name" in body


# =========================================================================
# POST /dev/log-marker
# =========================================================================


class TestDevLogMarker:
    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "event, passed",
        [
            ("start", None),
            ("end", True),
            ("end", False),
        ],
        ids=["start", "end_pass", "end_fail"],
    )
    async def test_log_marker_returns_ok(self, session, event, passed):
        payload = {"event": event, "title": "test > some spec"}
        if passed is not None:
            payload["passed"] = passed

        response = await execute_post_request("/dev/log-marker", payload)
        assert response.status_code == 200
        assert response.json()["ok"] is True

    @pytest.mark.asyncio
    async def test_invalid_event_returns_422(self, session):
        response = await execute_post_request(
            "/dev/log-marker",
            {"event": "invalid", "title": "test"},
        )
        assert response.status_code == 422

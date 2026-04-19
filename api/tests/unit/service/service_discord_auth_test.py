"""Unit tests for DiscordAuthService."""
import uuid
from unittest.mock import MagicMock, AsyncMock

import httpx
import pytest
from fastapi import HTTPException

from src.security.secrets import SECRET
from src.services.DiscordAuthService import DiscordAuthService
from src.enums.Roles import Roles
from src.models import User
from src.utils.email_hash import hash_email
from tests.utils.utils_constant import USER_ID, DISCORD_ID, USER_LOGIN, USER_EMAIL


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _mock_session(mocker):
    session = mocker.AsyncMock()
    session.add = mocker.MagicMock()
    return session


def _make_user(discord_id=DISCORD_ID, login=USER_LOGIN):
    return User(
        id=USER_ID,
        login=login,
        discord_id=discord_id,
        email_hash=hash_email(USER_EMAIL),
        email_hash_version=SECRET.EMAIL_PEPPER_VERSION,
        role=Roles.USER,
    )


def _make_http_client_mock(mocker, status_code=200, json_body=None, raise_error=None):
    """Build a mock httpx.AsyncClient context manager."""
    mock_response = MagicMock()
    mock_response.status_code = status_code
    mock_response.json.return_value = json_body or {}

    mock_client = AsyncMock()
    if raise_error:
        mock_client.get.side_effect = raise_error
    else:
        mock_client.get.return_value = mock_response
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    return mock_client


# =========================================================================
# verify_discord_token
# =========================================================================


class TestVerifyDiscordToken:
    @pytest.mark.asyncio
    async def test_success_returns_profile(self, mocker):
        profile = {"id": "123", "username": "testuser", "email": "test@discord.com"}
        mock_client = _make_http_client_mock(mocker, status_code=200, json_body=profile)
        mocker.patch("src.services.DiscordAuthService.httpx.AsyncClient", return_value=mock_client)

        result = await DiscordAuthService.verify_discord_token("valid_token")

        assert result["id"] == "123"
        assert result["username"] == "testuser"

    @pytest.mark.asyncio
    async def test_discord_returns_401_raises_http_401(self, mocker):
        mock_client = _make_http_client_mock(mocker, status_code=401)
        mocker.patch("src.services.DiscordAuthService.httpx.AsyncClient", return_value=mock_client)

        with pytest.raises(HTTPException) as exc:
            await DiscordAuthService.verify_discord_token("bad_token")
        assert exc.value.status_code == 401

    @pytest.mark.asyncio
    async def test_discord_returns_5xx_raises_http_502(self, mocker):
        mock_client = _make_http_client_mock(mocker, status_code=500)
        mocker.patch("src.services.DiscordAuthService.httpx.AsyncClient", return_value=mock_client)

        with pytest.raises(HTTPException) as exc:
            await DiscordAuthService.verify_discord_token("some_token")
        assert exc.value.status_code == 502

    @pytest.mark.asyncio
    async def test_network_error_raises_http_502(self, mocker):
        mock_client = _make_http_client_mock(
            mocker, raise_error=httpx.ConnectError("Connection refused")
        )
        mocker.patch("src.services.DiscordAuthService.httpx.AsyncClient", return_value=mock_client)

        with pytest.raises(HTTPException) as exc:
            await DiscordAuthService.verify_discord_token("token")
        assert exc.value.status_code == 502


# =========================================================================
# _normalize_login
# =========================================================================


class TestNormalizeLogin:
    def test_strips_non_alphanumeric_chars(self):
        result = DiscordAuthService._normalize_login("test.user#1234")
        assert result == "testuser1234"

    def test_truncates_long_username(self):
        result = DiscordAuthService._normalize_login("averylongusername99999")
        assert len(result) <= 15

    def test_pure_alphanumeric_unchanged(self):
        result = DiscordAuthService._normalize_login("ValidUser123")
        assert result == "ValidUser123"

    def test_short_username_gets_random_suffix(self, mocker):
        mocker.patch(
            "src.services.DiscordAuthService.random.choices",
            return_value=list("1234"),
        )
        result = DiscordAuthService._normalize_login("ab")
        assert len(result) >= 4
        assert result.startswith("ab")
        assert result.endswith("1234")


# =========================================================================
# get_user_by_discord_id
# =========================================================================


class TestGetUserByDiscordId:
    @pytest.mark.asyncio
    async def test_found_returns_user(self, mocker):
        session = _mock_session(mocker)
        user = _make_user()
        result_mock = mocker.MagicMock()
        result_mock.first.return_value = user
        session.exec.return_value = result_mock

        result = await DiscordAuthService.get_user_by_discord_id(session, DISCORD_ID)
        assert result is user

    @pytest.mark.asyncio
    async def test_not_found_returns_none(self, mocker):
        session = _mock_session(mocker)
        result_mock = mocker.MagicMock()
        result_mock.first.return_value = None
        session.exec.return_value = result_mock

        result = await DiscordAuthService.get_user_by_discord_id(session, "unknown_id")
        assert result is None


# =========================================================================
# get_or_create_discord_user
# =========================================================================

_DISCORD_PROFILE = {
    "id": DISCORD_ID,
    "username": USER_LOGIN,
    "email": USER_EMAIL,
    "avatar": None,
}


class TestGetOrCreateDiscordUser:
    @pytest.mark.asyncio
    async def test_existing_user_is_returned_and_updated(self, mocker):
        session = _mock_session(mocker)
        existing_user = _make_user()

        mocker.patch.object(
            DiscordAuthService, "get_user_by_discord_id", return_value=existing_user
        )

        result = await DiscordAuthService.get_or_create_discord_user(
            session, _DISCORD_PROFILE
        )

        assert result is existing_user
        session.add.assert_called()
        session.commit.assert_awaited()

    @pytest.mark.asyncio
    async def test_new_user_is_created_when_discord_id_unknown(self, mocker):
        session = _mock_session(mocker)

        mocker.patch.object(
            DiscordAuthService, "get_user_by_discord_id", return_value=None
        )
        mocker.patch.object(
            DiscordAuthService, "_generate_unique_login", return_value="newlogin"
        )

        # No email hash conflict
        no_conflict_mock = mocker.MagicMock()
        no_conflict_mock.first.return_value = None
        session.exec.return_value = no_conflict_mock

        result = await DiscordAuthService.get_or_create_discord_user(
            session, _DISCORD_PROFILE
        )

        assert result is not None
        assert result.discord_id == str(_DISCORD_PROFILE["id"])
        assert result.login == "newlogin"
        session.commit.assert_awaited()

    @pytest.mark.asyncio
    async def test_email_conflict_raises_409(self, mocker):
        session = _mock_session(mocker)
        conflicting_user = _make_user(discord_id="other_discord_id", login="otherlogin")

        mocker.patch.object(
            DiscordAuthService, "get_user_by_discord_id", return_value=None
        )

        conflict_mock = mocker.MagicMock()
        conflict_mock.first.return_value = conflicting_user
        session.exec.return_value = conflict_mock

        with pytest.raises(HTTPException) as exc:
            await DiscordAuthService.get_or_create_discord_user(session, _DISCORD_PROFILE)
        assert exc.value.status_code == 409

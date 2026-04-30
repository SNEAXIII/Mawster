"""Unit tests for GoogleAuthService."""

from unittest.mock import MagicMock, AsyncMock

import httpx
import pytest
from fastapi import HTTPException

from src.security.secrets import SECRET
from src.services.GoogleAuthService import GoogleAuthService
from src.enums.Roles import Roles
from src.models import User
from src.utils.hashing import hash_email, hash_provider_id
from tests.utils.utils_constant import USER_ID, USER_LOGIN, USER_EMAIL

GOOGLE_ID = "google_123456"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _mock_session(mocker):
    session = mocker.AsyncMock()
    session.add = mocker.MagicMock()
    return session


def _make_user(google_id=GOOGLE_ID, login=USER_LOGIN):
    return User(
        id=USER_ID,
        login=login,
        google_id=hash_provider_id(google_id),
        email_hash=hash_email(USER_EMAIL),
        email_hash_version=SECRET.EMAIL_PEPPER_VERSION,
        role=Roles.USER,
    )


def _make_http_client_mock(mocker, status_code=200, json_body=None, raise_error=None):
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
# verify_token
# =========================================================================


class TestVerifyToken:
    @pytest.mark.asyncio
    async def test_success_returns_profile(self, mocker):
        profile = {"sub": GOOGLE_ID, "email": USER_EMAIL, "name": USER_LOGIN, "picture": None}
        mock_client = _make_http_client_mock(mocker, status_code=200, json_body=profile)
        mocker.patch("src.services.GoogleAuthService.httpx.AsyncClient", return_value=mock_client)

        result = await GoogleAuthService.verify_token("valid_token")

        assert result["sub"] == GOOGLE_ID
        assert result["email"] == USER_EMAIL

    @pytest.mark.asyncio
    async def test_google_returns_401_raises_http_401(self, mocker):
        mock_client = _make_http_client_mock(mocker, status_code=401)
        mocker.patch("src.services.GoogleAuthService.httpx.AsyncClient", return_value=mock_client)

        with pytest.raises(HTTPException) as exc:
            await GoogleAuthService.verify_token("bad_token")
        assert exc.value.status_code == 401

    @pytest.mark.asyncio
    async def test_google_returns_5xx_raises_http_502(self, mocker):
        mock_client = _make_http_client_mock(mocker, status_code=500)
        mocker.patch("src.services.GoogleAuthService.httpx.AsyncClient", return_value=mock_client)

        with pytest.raises(HTTPException) as exc:
            await GoogleAuthService.verify_token("some_token")
        assert exc.value.status_code == 502

    @pytest.mark.asyncio
    async def test_network_error_raises_http_502(self, mocker):
        mock_client = _make_http_client_mock(
            mocker, raise_error=httpx.ConnectError("Connection refused")
        )
        mocker.patch("src.services.GoogleAuthService.httpx.AsyncClient", return_value=mock_client)

        with pytest.raises(HTTPException) as exc:
            await GoogleAuthService.verify_token("token")
        assert exc.value.status_code == 502


# =========================================================================
# get_or_create_user
# =========================================================================

_GOOGLE_PROFILE = {
    "sub": GOOGLE_ID,
    "email": USER_EMAIL,
    "name": USER_LOGIN,
}


class TestGetOrCreateUser:
    @pytest.mark.asyncio
    async def test_existing_user_is_returned_and_updated(self, mocker):
        session = _mock_session(mocker)
        existing_user = _make_user()

        found_mock = mocker.MagicMock()
        found_mock.first.return_value = existing_user
        # Second exec call (email check) never reached
        session.exec.return_value = found_mock

        result = await GoogleAuthService.get_or_create_user(session, _GOOGLE_PROFILE)

        assert result is existing_user
        session.add.assert_called()
        session.commit.assert_awaited()

    @pytest.mark.asyncio
    async def test_new_user_is_created_when_google_id_unknown(self, mocker):
        session = _mock_session(mocker)

        mocker.patch.object(GoogleAuthService, "_generate_unique_login", return_value="newlogin")

        no_result = mocker.MagicMock()
        no_result.first.return_value = None
        session.exec.return_value = no_result

        result = await GoogleAuthService.get_or_create_user(session, _GOOGLE_PROFILE)

        assert result is not None
        assert result.google_id == hash_provider_id(GOOGLE_ID)
        assert result.login == "newlogin"
        session.commit.assert_awaited()

    @pytest.mark.asyncio
    async def test_email_conflict_raises_409(self, mocker):
        session = _mock_session(mocker)
        conflicting_user = _make_user(google_id="other_google_id", login="otherlogin")

        # First exec (google_id lookup) → not found
        # Second exec (email hash lookup) → conflict
        not_found = mocker.MagicMock()
        not_found.first.return_value = None
        conflict = mocker.MagicMock()
        conflict.first.return_value = conflicting_user
        session.exec.side_effect = [not_found, conflict]

        with pytest.raises(HTTPException) as exc:
            await GoogleAuthService.get_or_create_user(session, _GOOGLE_PROFILE)
        assert exc.value.status_code == 409

    @pytest.mark.asyncio
    async def test_user_without_email_gets_placeholder(self, mocker):
        session = _mock_session(mocker)
        profile_no_email = {**_GOOGLE_PROFILE, "email": None}

        mocker.patch.object(GoogleAuthService, "_generate_unique_login", return_value="somelogin")

        no_result = mocker.MagicMock()
        no_result.first.return_value = None
        session.exec.return_value = no_result

        result = await GoogleAuthService.get_or_create_user(session, profile_no_email)

        assert result.google_id == hash_provider_id(GOOGLE_ID)
        # email_hash computed from placeholder, not None
        assert result.email_hash is not None

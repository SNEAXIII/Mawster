"""Unit tests for GoogleAuthService."""

from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest
from fastapi import HTTPException

from src.enums.Roles import Roles
from src.models import User
from src.security.secrets import SECRET
from src.services.auth.GoogleAuthService import GoogleAuthService
from src.utils.email_hash import hash_email
from tests.utils.utils_constant import USER_EMAIL, USER_ID, USER_LOGIN

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
        google_id=google_id,
        email_hash=hash_email(USER_EMAIL),
        email_hash_version=SECRET.EMAIL_PEPPER_VERSION,
        role=Roles.USER,
    )


def _patch_google_two_calls(mocker, tokeninfo_body, tokeninfo_status=200, userinfo_body=None):
    """Patch httpx so the first .get() answers tokeninfo and the second userinfo."""
    tokeninfo_response = MagicMock()
    tokeninfo_response.status_code = tokeninfo_status
    tokeninfo_response.json.return_value = tokeninfo_body

    userinfo_response = MagicMock()
    userinfo_response.status_code = 200
    userinfo_response.json.return_value = userinfo_body or {
        "sub": GOOGLE_ID,
        "email": USER_EMAIL,
        "email_verified": True,
    }

    mock_client = AsyncMock()
    mock_client.get.side_effect = [tokeninfo_response, userinfo_response]
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    mocker.patch("src.services.auth.GoogleAuthService.httpx.AsyncClient", return_value=mock_client)
    return mock_client


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
        _patch_google_two_calls(mocker, {"aud": SECRET.GOOGLE_CLIENT_ID}, userinfo_body=profile)

        result = await GoogleAuthService.verify_token("valid_token")

        assert result["sub"] == GOOGLE_ID
        assert result["email"] == USER_EMAIL

    @pytest.mark.asyncio
    async def test_google_returns_401_raises_http_401(self, mocker):
        mock_client = _make_http_client_mock(mocker, status_code=401)
        mocker.patch(
            "src.services.auth.GoogleAuthService.httpx.AsyncClient", return_value=mock_client
        )

        with pytest.raises(HTTPException) as exc:
            await GoogleAuthService.verify_token("bad_token")
        assert exc.value.status_code == 401

    @pytest.mark.asyncio
    async def test_google_returns_5xx_raises_http_502(self, mocker):
        mock_client = _make_http_client_mock(mocker, status_code=500)
        mocker.patch(
            "src.services.auth.GoogleAuthService.httpx.AsyncClient", return_value=mock_client
        )

        with pytest.raises(HTTPException) as exc:
            await GoogleAuthService.verify_token("some_token")
        assert exc.value.status_code == 502

    @pytest.mark.asyncio
    async def test_network_error_raises_http_502(self, mocker):
        mock_client = _make_http_client_mock(
            mocker, raise_error=httpx.ConnectError("Connection refused")
        )
        mocker.patch(
            "src.services.auth.GoogleAuthService.httpx.AsyncClient", return_value=mock_client
        )

        with pytest.raises(HTTPException) as exc:
            await GoogleAuthService.verify_token("token")
        assert exc.value.status_code == 502

    @pytest.mark.asyncio
    async def test_token_issued_to_mawster_is_accepted(self, mocker):
        _patch_google_two_calls(mocker, {"aud": SECRET.GOOGLE_CLIENT_ID})

        result = await GoogleAuthService.verify_token("good_token")

        assert result["sub"] == GOOGLE_ID

    @pytest.mark.asyncio
    async def test_token_issued_to_another_application_raises_http_401(self, mocker):
        _patch_google_two_calls(mocker, {"aud": "attacker.apps.googleusercontent.com"})

        with pytest.raises(HTTPException) as exc:
            await GoogleAuthService.verify_token("stolen_token")
        assert exc.value.status_code == 401

    @pytest.mark.asyncio
    async def test_foreign_token_never_reaches_the_profile_endpoint(self, mocker):
        client = _patch_google_two_calls(mocker, {"aud": "attacker.apps.googleusercontent.com"})

        with pytest.raises(HTTPException):
            await GoogleAuthService.verify_token("stolen_token")
        assert client.get.call_count == 1


# =========================================================================
# get_or_create_user
# =========================================================================

_GOOGLE_PROFILE = {
    "sub": GOOGLE_ID,
    "email": USER_EMAIL,
    "email_verified": True,
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
        assert result.google_id == GOOGLE_ID
        assert result.login == "newlogin"
        session.commit.assert_awaited()

    @pytest.mark.asyncio
    async def test_email_conflict_raises_409(self, mocker):
        """When email matches an account with a different google_id, linking is refused."""
        session = _mock_session(mocker)
        conflicting_user = _make_user(google_id="other_google_id", login="otherlogin")

        # resolve_user flow:
        # 1. _get_user_by_provider_id(google_id="google_123456") → not found
        # 2. email is verified and present, so hash it
        # 3. _get_user_by_email_hash(email_hash) → conflict found
        # 4. _link_provider checks if conflicting_user.google_id is set → it is → PROVIDER_ALREADY_LINKED
        not_found = mocker.MagicMock()
        not_found.first.return_value = None
        conflict = mocker.MagicMock()
        conflict.first.return_value = conflicting_user
        session.exec.side_effect = [not_found, conflict]

        with pytest.raises(HTTPException) as exc:
            await GoogleAuthService.get_or_create_user(session, _GOOGLE_PROFILE)
        assert exc.value.status_code == 409
        # New behavior: error detail is {"code": "PROVIDER_ALREADY_LINKED", "message": "..."}
        assert exc.value.detail["code"] == "PROVIDER_ALREADY_LINKED"

    @pytest.mark.asyncio
    async def test_user_without_email_gets_no_hash(self, mocker):
        session = _mock_session(mocker)
        profile_no_email = {**_GOOGLE_PROFILE, "email": None}

        mocker.patch.object(GoogleAuthService, "_generate_unique_login", return_value="somelogin")

        no_result = mocker.MagicMock()
        no_result.first.return_value = None
        session.exec.return_value = no_result

        result = await GoogleAuthService.get_or_create_user(session, profile_no_email)

        assert result.google_id == GOOGLE_ID
        # Unverified/missing emails are not hashed, only verified ones are
        assert result.email_hash is None

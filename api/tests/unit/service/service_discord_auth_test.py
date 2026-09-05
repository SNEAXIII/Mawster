"""Unit tests for DiscordAuthService."""

from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest
from fastapi import HTTPException

from src.enums.Roles import Roles
from src.models import User
from src.security.secrets import SECRET
from src.services.auth.DiscordAuthService import DiscordAuthService
from src.utils.email_hash import hash_email
from tests.utils.utils_constant import DISCORD_ID, USER_EMAIL, USER_ID, USER_LOGIN

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


def _patch_discord_http_client(mocker, status_code=200, json_body=None, raise_error=None):
    """Build and patch httpx.AsyncClient for DiscordAuthService."""
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

    mocker.patch("src.services.auth.DiscordAuthService.httpx.AsyncClient", return_value=mock_client)
    return mock_client


def _patch_discord_two_calls(mocker, oauth_body, oauth_status=200, user_body=None):
    """Patch httpx so the first .get() answers /oauth2/@me and the second /users/@me."""
    oauth_response = MagicMock()
    oauth_response.status_code = oauth_status
    oauth_response.json.return_value = oauth_body

    user_response = MagicMock()
    user_response.status_code = 200
    user_response.json.return_value = user_body or {
        "id": "123",
        "username": "testuser",
        "email": "test@discord.com",
    }

    mock_client = AsyncMock()
    mock_client.get.side_effect = [oauth_response, user_response]
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    mocker.patch("src.services.auth.DiscordAuthService.httpx.AsyncClient", return_value=mock_client)
    return mock_client


# =========================================================================
# verify_discord_token
# =========================================================================


class TestVerifyDiscordToken:
    @pytest.mark.asyncio
    async def test_success_returns_profile(self, mocker):
        profile = {"id": "123", "username": "testuser", "email": "test@discord.com"}
        _patch_discord_two_calls(
            mocker,
            {"application": {"id": SECRET.DISCORD_CLIENT_ID}},
            user_body=profile,
        )

        result = await DiscordAuthService.verify_token("valid_token")

        assert result["id"] == "123"
        assert result["username"] == "testuser"

    @pytest.mark.asyncio
    async def test_discord_returns_401_raises_http_401(self, mocker):
        _patch_discord_http_client(mocker, status_code=401)

        with pytest.raises(HTTPException) as exc:
            await DiscordAuthService.verify_token("bad_token")
        assert exc.value.status_code == 401

    @pytest.mark.asyncio
    async def test_discord_returns_5xx_raises_http_502(self, mocker):
        _patch_discord_http_client(mocker, status_code=500)

        with pytest.raises(HTTPException) as exc:
            await DiscordAuthService.verify_token("some_token")
        assert exc.value.status_code == 502

    @pytest.mark.asyncio
    async def test_network_error_raises_http_502(self, mocker):
        _patch_discord_http_client(mocker, raise_error=httpx.ConnectError("Connection refused"))

        with pytest.raises(HTTPException) as exc:
            await DiscordAuthService.verify_token("token")
        assert exc.value.status_code == 502

    @pytest.mark.asyncio
    async def test_token_issued_to_mawster_is_accepted(self, mocker):
        _patch_discord_two_calls(mocker, {"application": {"id": SECRET.DISCORD_CLIENT_ID}})

        result = await DiscordAuthService.verify_token("good_token")

        assert result["id"] == "123"

    @pytest.mark.asyncio
    async def test_token_issued_to_another_application_raises_http_401(self, mocker):
        _patch_discord_two_calls(mocker, {"application": {"id": "someone_elses_app"}})

        with pytest.raises(HTTPException) as exc:
            await DiscordAuthService.verify_token("stolen_token")
        assert exc.value.status_code == 401

    @pytest.mark.asyncio
    async def test_foreign_token_never_reaches_the_profile_endpoint(self, mocker):
        client = _patch_discord_two_calls(mocker, {"application": {"id": "someone_elses_app"}})

        with pytest.raises(HTTPException):
            await DiscordAuthService.verify_token("stolen_token")
        assert client.get.call_count == 1


# =========================================================================
# get_user_by_provider_id (inherited seam from OAuthService)
# =========================================================================


class TestGetUserByProviderId:
    @pytest.mark.asyncio
    async def test_found_returns_user(self, mocker):
        session = _mock_session(mocker)
        user = _make_user()
        result_mock = mocker.MagicMock()
        result_mock.first.return_value = user
        session.exec.return_value = result_mock

        result = await DiscordAuthService._get_user_by_provider_id(
            session, "discord_id", DISCORD_ID
        )
        assert result is user

    @pytest.mark.asyncio
    async def test_not_found_returns_none(self, mocker):
        session = _mock_session(mocker)
        result_mock = mocker.MagicMock()
        result_mock.first.return_value = None
        session.exec.return_value = result_mock

        result = await DiscordAuthService._get_user_by_provider_id(
            session, "discord_id", "unknown_id"
        )
        assert result is None


# =========================================================================
# get_or_create_discord_user
# =========================================================================

_DISCORD_PROFILE = {
    "id": DISCORD_ID,
    "username": USER_LOGIN,
    "email": USER_EMAIL,
    "verified": True,
}


class TestGetOrCreateDiscordUser:
    @pytest.mark.asyncio
    async def test_existing_user_is_returned_and_updated(self, mocker):
        session = _mock_session(mocker)
        existing_user = _make_user()

        mocker.patch.object(
            DiscordAuthService, "_get_user_by_provider_id", return_value=existing_user
        )

        result = await DiscordAuthService.get_or_create_user(session, _DISCORD_PROFILE)

        assert result is existing_user
        session.add.assert_called()
        session.commit.assert_awaited()

    @pytest.mark.asyncio
    async def test_new_user_is_created_when_discord_id_unknown(self, mocker):
        """A verified email with no existing match creates a fresh, hashed account."""
        session = _mock_session(mocker)

        mocker.patch.object(DiscordAuthService, "_get_user_by_provider_id", return_value=None)
        mocker.patch.object(DiscordAuthService, "_generate_unique_login", return_value="newlogin")

        no_match_mock = mocker.MagicMock()
        no_match_mock.first.return_value = None
        session.exec.return_value = no_match_mock

        result = await DiscordAuthService.get_or_create_user(session, _DISCORD_PROFILE)

        assert result is not None
        assert result.discord_id == str(_DISCORD_PROFILE["id"])
        assert result.login == "newlogin"
        assert result.email_hash == hash_email(_DISCORD_PROFILE["email"])
        session.commit.assert_awaited()

    @pytest.mark.asyncio
    async def test_unverified_email_creates_account_without_hash(self, mocker):
        """An unverified address is never hashed, even for a brand new account."""
        session = _mock_session(mocker)
        profile = {**_DISCORD_PROFILE, "verified": False}

        mocker.patch.object(DiscordAuthService, "_get_user_by_provider_id", return_value=None)
        mocker.patch.object(DiscordAuthService, "_generate_unique_login", return_value="newlogin")

        result = await DiscordAuthService.get_or_create_user(session, profile)

        assert result.discord_id == str(profile["id"])
        assert result.login == "newlogin"
        assert result.email_hash is None
        # An unlinkable (unverified) email never triggers the email-hash lookup.
        session.exec.assert_not_called()
        session.commit.assert_awaited()

    @pytest.mark.asyncio
    async def test_links_to_account_with_free_discord_slot(self, mocker):
        """A verified email matching an account with no discord_id yet gets linked."""
        session = _mock_session(mocker)
        matched_user = _make_user(discord_id=None)

        mocker.patch.object(DiscordAuthService, "_get_user_by_provider_id", return_value=None)

        match_mock = mocker.MagicMock()
        match_mock.first.return_value = matched_user
        session.exec.return_value = match_mock

        result = await DiscordAuthService.get_or_create_user(session, _DISCORD_PROFILE)

        assert result is matched_user
        assert result.discord_id == str(_DISCORD_PROFILE["id"])
        session.commit.assert_awaited()

    @pytest.mark.asyncio
    async def test_provider_already_linked_raises_409(self, mocker):
        """The address is held by an account that already has a different discord_id."""
        session = _mock_session(mocker)
        conflicting_user = _make_user(discord_id="other_discord_id", login="otherlogin")

        mocker.patch.object(DiscordAuthService, "_get_user_by_provider_id", return_value=None)

        conflict_mock = mocker.MagicMock()
        conflict_mock.first.return_value = conflicting_user
        session.exec.return_value = conflict_mock

        with pytest.raises(HTTPException) as exc:
            await DiscordAuthService.get_or_create_user(session, _DISCORD_PROFILE)
        assert exc.value.status_code == 409
        assert exc.value.detail["code"] == "PROVIDER_ALREADY_LINKED"

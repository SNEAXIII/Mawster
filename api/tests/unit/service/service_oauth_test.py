"""Unit tests for OAuthService shared logic."""

import pytest
from unittest.mock import AsyncMock, MagicMock

from src.services.auth.OAuthService import OAuthService


class TestNormalizeLogin:
    def test_strips_non_alphanumeric_chars(self):
        result = OAuthService._normalize_login("test.user#1234")
        assert result == "testuser1234"

    def test_truncates_long_username(self):
        result = OAuthService._normalize_login("averylongusername99999")
        assert len(result) <= 15

    def test_pure_alphanumeric_unchanged(self):
        result = OAuthService._normalize_login("ValidUser123")
        assert result == "ValidUser123"

    def test_short_username_gets_random_suffix(self, mocker):
        mocker.patch(
            "src.services.auth.OAuthService.random.choices",
            return_value=list("1234"),
        )
        result = OAuthService._normalize_login("ab")
        assert len(result) >= 4
        assert result.startswith("ab")
        assert result.endswith("1234")


class TestGenerateUniqueLogin:
    def _make_session(self, collision_count: int) -> AsyncMock:
        """Return a mock session that returns a user for the first `collision_count` execs, then None."""
        session = AsyncMock()
        taken = MagicMock()
        taken.first.return_value = MagicMock()
        free = MagicMock()
        free.first.return_value = None

        side_effects = [taken] * collision_count + [free]
        session.exec = AsyncMock(side_effect=side_effects)
        return session

    @pytest.mark.asyncio
    async def test_returns_base_login_when_no_collision(self):
        session = self._make_session(0)
        result = await OAuthService._generate_unique_login(session, "cosmichero12")
        assert result == "cosmichero12"

    @pytest.mark.asyncio
    async def test_appends_suffix_on_first_collision(self, mocker):
        mocker.patch("src.services.auth.OAuthService.random.choices", return_value=list("999"))
        session = self._make_session(1)
        result = await OAuthService._generate_unique_login(session, "cosmichero12")
        assert result == "cosmichero12999"

    @pytest.mark.asyncio
    async def test_fallback_login_when_all_10_collide(self, mocker):
        mocker.patch(
            "src.services.auth.OAuthService.random.choices",
            return_value=list("abcdefghij"),
        )
        session = AsyncMock()
        taken = MagicMock()
        taken.first.return_value = MagicMock()
        session.exec = AsyncMock(return_value=taken)

        result = await OAuthService._generate_unique_login(session, "cosmichero12")
        assert result.startswith("user")
        assert len(result) == 14  # "user" + 10 chars

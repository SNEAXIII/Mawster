"""Unit tests for DiscordAuthService — pure/synchronous logic only."""
import pytest

from src.services.DiscordAuthService import DiscordAuthService


# ── _normalize_login ──────────────────────────────────────────────────────────


class TestNormalizeLogin:
    def test_strips_non_alphanumeric_characters(self):
        result = DiscordAuthService._normalize_login("hello.world!")
        assert result == "helloworld"

    def test_truncates_to_15_characters(self):
        result = DiscordAuthService._normalize_login("averylongusernamethatexceeds15")
        assert len(result) == 15

    def test_preserves_alphanumeric_unchanged(self):
        result = DiscordAuthService._normalize_login("Player123")
        assert result == "Player123"

    def test_short_input_padded_with_digits(self):
        """Login shorter than 4 chars after cleaning gets a numeric suffix."""
        result = DiscordAuthService._normalize_login("ab")
        assert len(result) >= 4
        assert result.startswith("ab")
        assert result[2:].isdigit()

    def test_empty_string_produces_four_digit_suffix(self):
        """Fully non-alphanumeric input produces a 4-digit string."""
        result = DiscordAuthService._normalize_login("---")
        assert len(result) == 4
        assert result.isdigit()

    def test_exactly_four_chars_not_padded(self):
        result = DiscordAuthService._normalize_login("abcd")
        assert result == "abcd"

    def test_unicode_special_chars_stripped(self):
        result = DiscordAuthService._normalize_login("ñoño")
        # All non-alphanumeric → padded
        assert len(result) >= 4

    def test_mixed_case_preserved(self):
        result = DiscordAuthService._normalize_login("CoolPlayer")
        assert result == "CoolPlayer"

    @pytest.mark.parametrize(
        "username, expected_prefix",
        [
            ("Iron_Man_3000", "IronMan3000"),
            ("Spider-Man", "SpiderMan"),
            ("Thor.Odinson", "ThorOdinson"),
        ],
        ids=["underscore", "hyphen", "dot"],
    )
    def test_common_separators_are_stripped(self, username, expected_prefix):
        result = DiscordAuthService._normalize_login(username)
        assert result == expected_prefix[:15]


# ── get_user_by_discord_id ────────────────────────────────────────────────────


class TestGetUserByDiscordId:
    @pytest.mark.asyncio
    async def test_returns_none_when_not_found(self, mocker):
        session = mocker.AsyncMock()
        exec_result = mocker.MagicMock()
        exec_result.first.return_value = None
        session.exec = mocker.AsyncMock(return_value=exec_result)

        result = await DiscordAuthService.get_user_by_discord_id(session, "nonexistent_id")
        assert result is None

    @pytest.mark.asyncio
    async def test_returns_user_when_found(self, mocker):
        from src.models import User
        user = User(login="testuser", discord_id="123456")

        session = mocker.AsyncMock()
        exec_result = mocker.MagicMock()
        exec_result.first.return_value = user
        session.exec = mocker.AsyncMock(return_value=exec_result)

        result = await DiscordAuthService.get_user_by_discord_id(session, "123456")
        assert result == user

"""Unit tests for OAuthService shared logic."""

import pytest

from src.services.OAuthService import OAuthService


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
            "src.services.OAuthService.random.choices",
            return_value=list("1234"),
        )
        result = OAuthService._normalize_login("ab")
        assert len(result) >= 4
        assert result.startswith("ab")
        assert result.endswith("1234")

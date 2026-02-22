"""Unit tests for GameAccountService using mocked sessions."""
import uuid
from unittest.mock import MagicMock, AsyncMock

import pytest
from fastapi import HTTPException

from src.models.GameAccount import GameAccount
from src.services.GameService import GameAccountService, MAX_GAME_ACCOUNTS_PER_USER
from tests.utils.utils_constant import USER_ID, GAME_PSEUDO, GAME_PSEUDO_2


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _mock_session(mocker):
    """Return an AsyncMock pretending to be an async DB session."""
    session = mocker.AsyncMock()
    session.add = mocker.MagicMock()
    return session


def _make_account(
    user_id=USER_ID,
    pseudo=GAME_PSEUDO,
    is_primary=False,
    alliance_id=None,
) -> GameAccount:
    return GameAccount(
        id=uuid.uuid4(),
        user_id=user_id,
        game_pseudo=pseudo,
        is_primary=is_primary,
        alliance_id=alliance_id,
    )


# =========================================================================
# create_game_account
# =========================================================================


class TestCreateGameAccount:
    @pytest.mark.asyncio
    async def test_create_ok(self, mocker):
        # Arrange
        session = _mock_session(mocker)
        result_mock = mocker.MagicMock()
        result_mock.all.return_value = []  # no existing accounts
        session.exec.return_value = result_mock

        # Act
        account = await GameAccountService.create_game_account(
            session, USER_ID, GAME_PSEUDO, True
        )

        # Assert
        assert account.user_id == USER_ID
        assert account.game_pseudo == GAME_PSEUDO
        assert account.is_primary is True
        session.add.assert_called_once()
        session.commit.assert_awaited_once()
        session.refresh.assert_awaited_once()

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "existing_count",
        [MAX_GAME_ACCOUNTS_PER_USER, MAX_GAME_ACCOUNTS_PER_USER + 5],
        ids=["exact_limit", "over_limit"],
    )
    async def test_create_exceeds_limit(self, mocker, existing_count):
        # Arrange
        session = _mock_session(mocker)
        result_mock = mocker.MagicMock()
        result_mock.all.return_value = [_make_account() for _ in range(existing_count)]
        session.exec.return_value = result_mock

        # Act / Assert
        with pytest.raises(HTTPException) as exc:
            await GameAccountService.create_game_account(
                session, USER_ID, GAME_PSEUDO
            )
        assert exc.value.status_code == 400
        assert str(MAX_GAME_ACCOUNTS_PER_USER) in exc.value.detail


# =========================================================================
# get_game_accounts_by_user
# =========================================================================


class TestGetGameAccountsByUser:
    @pytest.mark.asyncio
    async def test_returns_accounts(self, mocker):
        session = _mock_session(mocker)
        accounts = [_make_account(), _make_account(pseudo=GAME_PSEUDO_2)]
        result_mock = mocker.MagicMock()
        result_mock.all.return_value = accounts
        session.exec.return_value = result_mock

        result = await GameAccountService.get_game_accounts_by_user(session, USER_ID)

        assert len(result) == 2

    @pytest.mark.asyncio
    async def test_returns_empty(self, mocker):
        session = _mock_session(mocker)
        result_mock = mocker.MagicMock()
        result_mock.all.return_value = []
        session.exec.return_value = result_mock

        result = await GameAccountService.get_game_accounts_by_user(session, USER_ID)

        assert result == []


# =========================================================================
# get_game_account
# =========================================================================


class TestGetGameAccount:
    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "return_value, expected_none",
        [
            (_make_account(), False),
            (None, True),
        ],
        ids=["found", "not_found"],
    )
    async def test_get_game_account(self, mocker, return_value, expected_none):
        session = _mock_session(mocker)
        session.get.return_value = return_value

        result = await GameAccountService.get_game_account(session, uuid.uuid4())

        if expected_none:
            assert result is None
        else:
            assert result is return_value


# =========================================================================
# update_game_account
# =========================================================================


class TestUpdateGameAccount:
    @pytest.mark.asyncio
    async def test_update_ok(self, mocker):
        session = _mock_session(mocker)
        account = _make_account()

        result = await GameAccountService.update_game_account(
            session, account, GAME_PSEUDO_2, True
        )

        assert result.game_pseudo == GAME_PSEUDO_2
        assert result.is_primary is True
        session.add.assert_called_once()
        session.commit.assert_awaited_once()
        session.refresh.assert_awaited_once()


# =========================================================================
# delete_game_account
# =========================================================================


class TestDeleteGameAccount:
    @pytest.mark.asyncio
    async def test_delete_ok(self, mocker):
        session = _mock_session(mocker)
        account = _make_account()

        await GameAccountService.delete_game_account(session, account)

        session.delete.assert_awaited_once_with(account)
        session.commit.assert_awaited_once()

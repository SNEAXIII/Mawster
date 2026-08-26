"""Unit tests for GameAccountService using mocked sessions."""

import uuid
from datetime import timedelta

import pytest
from fastapi import HTTPException

from src.models.Base import utcnow
from src.models.user.GameAccount import GameAccount
from src.services.account.game.GameAccountService import (
    MAX_GAME_ACCOUNTS_PER_USER,
    RESTORE_WINDOW_DAYS,
    GameAccountService,
)
from tests.utils.utils_constant import GAME_PSEUDO, GAME_PSEUDO_2, USER_ID

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
    deleted_at=None,
) -> GameAccount:
    return GameAccount(
        id=uuid.uuid4(),
        user_id=user_id,
        game_pseudo=pseudo,
        is_primary=is_primary,
        alliance_id=alliance_id,
        deleted_at=deleted_at,
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
        account = await GameAccountService.create_game_account(session, USER_ID, GAME_PSEUDO, True)

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
            await GameAccountService.create_game_account(session, USER_ID, GAME_PSEUDO)
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

        # Mock the exec call for _ensure_single_primary (returns empty list)
        mock_result = mocker.MagicMock()
        mock_result.all.return_value = []
        session.exec.return_value = mock_result

        result = await GameAccountService.update_game_account(session, account, GAME_PSEUDO_2, True)

        assert result.game_pseudo == GAME_PSEUDO_2
        assert result.is_primary is True
        session.add.assert_called()
        session.commit.assert_awaited_once()
        session.refresh.assert_awaited_once()


# =========================================================================
# delete_game_account
# =========================================================================


def _empty_result(mocker):
    """An exec() result with no row, whatever the caller asks it for."""
    result = mocker.MagicMock()
    result.first.return_value = None
    result.all.return_value = []
    return result


class TestDeleteGameAccount:
    @pytest.mark.asyncio
    async def test_delete_is_logical(self, mocker):
        """The row survives: only deleted_at is stamped."""
        session = _mock_session(mocker)
        account = _make_account()
        session.exec = mocker.AsyncMock(return_value=_empty_result(mocker))

        await GameAccountService.delete_game_account(session, account)

        assert account.deleted_at is not None
        session.delete.assert_not_awaited()
        session.commit.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_delete_drops_the_primary_flag(self, mocker):
        session = _mock_session(mocker)
        account = _make_account(is_primary=True)
        session.exec = mocker.AsyncMock(return_value=_empty_result(mocker))

        await GameAccountService.delete_game_account(session, account)

        assert account.is_primary is False

    @pytest.mark.asyncio
    async def test_delete_account_in_alliance_raises_409(self, mocker):
        session = _mock_session(mocker)
        account = _make_account(alliance_id=uuid.uuid4())
        session.exec = mocker.AsyncMock(return_value=_empty_result(mocker))

        with pytest.raises(HTTPException) as exc:
            await GameAccountService.delete_game_account(session, account)

        assert exc.value.status_code == 409
        assert account.deleted_at is None

    @pytest.mark.asyncio
    async def test_delete_already_deleted_raises_409(self, mocker):
        session = _mock_session(mocker)
        account = _make_account(deleted_at=utcnow())
        session.exec = mocker.AsyncMock(return_value=_empty_result(mocker))

        with pytest.raises(HTTPException) as exc:
            await GameAccountService.delete_game_account(session, account)

        assert exc.value.status_code == 409


# =========================================================================
# restore_game_account
# =========================================================================


class TestRestoreGameAccount:
    @pytest.mark.asyncio
    async def test_restore_clears_deleted_at(self, mocker):
        session = _mock_session(mocker)
        account = _make_account(deleted_at=utcnow() - timedelta(days=1))
        session.exec = mocker.AsyncMock(return_value=_empty_result(mocker))

        result = await GameAccountService.restore_game_account(session, account)

        assert result.deleted_at is None
        session.commit.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_restore_outside_the_window_raises_410(self, mocker):
        session = _mock_session(mocker)
        account = _make_account(deleted_at=utcnow() - timedelta(days=RESTORE_WINDOW_DAYS, hours=1))
        session.exec = mocker.AsyncMock(return_value=_empty_result(mocker))

        with pytest.raises(HTTPException) as exc:
            await GameAccountService.restore_game_account(session, account)

        assert exc.value.status_code == 410
        assert account.deleted_at is not None

    @pytest.mark.asyncio
    async def test_restore_a_live_account_raises_409(self, mocker):
        session = _mock_session(mocker)
        account = _make_account()

        with pytest.raises(HTTPException) as exc:
            await GameAccountService.restore_game_account(session, account)

        assert exc.value.status_code == 409


# =========================================================================
# Restore window helpers
# =========================================================================


class TestRestoreWindow:
    def test_live_account_has_no_deadline(self):
        assert GameAccountService.restorable_until(_make_account()) is None
        assert GameAccountService.is_restorable(_make_account()) is False

    def test_deadline_is_deletion_plus_window(self):
        deleted_at = utcnow()
        account = _make_account(deleted_at=deleted_at)

        deadline = GameAccountService.restorable_until(account)

        assert deadline == deleted_at + timedelta(days=RESTORE_WINDOW_DAYS)
        assert GameAccountService.is_restorable(account) is True

    def test_naive_timestamp_from_the_db_is_handled(self):
        """DB timestamps come back naive — comparing them must not blow up."""
        account = _make_account(deleted_at=utcnow().replace(tzinfo=None))

        assert GameAccountService.is_restorable(account) is True

    def test_account_past_the_window_is_lost(self):
        account = _make_account(deleted_at=utcnow() - timedelta(days=RESTORE_WINDOW_DAYS, hours=1))

        assert GameAccountService.is_restorable(account) is False

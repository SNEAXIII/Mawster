"""Unit tests for AllianceVisitorService."""

import uuid

import pytest
from fastapi import HTTPException

from src.models.AllianceVisitor import AllianceVisitor
from src.services.alliance.AllianceVisitorService import AllianceVisitorService


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _mock_session(mocker):
    session = mocker.AsyncMock()
    session.add = mocker.MagicMock()
    return session


def _make_visitor(alliance_id=None, game_account_id=None):
    return AllianceVisitor(
        alliance_id=alliance_id or uuid.uuid4(),
        game_account_id=game_account_id or uuid.uuid4(),
    )


# =========================================================================
# count_visitors
# =========================================================================


class TestCountVisitors:
    @pytest.mark.asyncio
    async def test_returns_count(self, mocker):
        session = _mock_session(mocker)
        result_mock = mocker.MagicMock()
        result_mock.one.return_value = 3
        session.exec.return_value = result_mock

        count = await AllianceVisitorService.count_visitors(session, uuid.uuid4())
        assert count == 3

    @pytest.mark.asyncio
    async def test_returns_zero_when_empty(self, mocker):
        session = _mock_session(mocker)
        result_mock = mocker.MagicMock()
        result_mock.one.return_value = 0
        session.exec.return_value = result_mock

        count = await AllianceVisitorService.count_visitors(session, uuid.uuid4())
        assert count == 0


# =========================================================================
# is_visitor
# =========================================================================


class TestIsVisitor:
    @pytest.mark.asyncio
    async def test_true_when_found(self, mocker):
        session = _mock_session(mocker)
        visitor = _make_visitor()
        result_mock = mocker.MagicMock()
        result_mock.first.return_value = visitor
        session.exec.return_value = result_mock

        result = await AllianceVisitorService.is_visitor(session, uuid.uuid4(), uuid.uuid4())
        assert result is True

    @pytest.mark.asyncio
    async def test_false_when_not_found(self, mocker):
        session = _mock_session(mocker)
        result_mock = mocker.MagicMock()
        result_mock.first.return_value = None
        session.exec.return_value = result_mock

        result = await AllianceVisitorService.is_visitor(session, uuid.uuid4(), uuid.uuid4())
        assert result is False


# =========================================================================
# create_visitor
# =========================================================================


class TestCreateVisitor:
    @pytest.mark.asyncio
    async def test_raises_409_when_already_visitor(self, mocker):
        session = _mock_session(mocker)
        visitor = _make_visitor()
        result_mock = mocker.MagicMock()
        result_mock.first.return_value = visitor
        session.exec.return_value = result_mock

        with pytest.raises(HTTPException) as exc:
            await AllianceVisitorService.create_visitor(session, uuid.uuid4(), uuid.uuid4())
        assert exc.value.status_code == 409

    @pytest.mark.asyncio
    async def test_creates_visitor_when_not_existing(self, mocker):
        session = _mock_session(mocker)
        alliance_id = uuid.uuid4()
        game_account_id = uuid.uuid4()

        # Mock for find_visitor (returns None) and count_visitors (returns 0)
        find_result_mock = mocker.MagicMock()
        find_result_mock.first.return_value = None

        count_result_mock = mocker.MagicMock()
        count_result_mock.one.return_value = 0

        session.exec = mocker.AsyncMock(side_effect=[find_result_mock, count_result_mock])

        result = await AllianceVisitorService.create_visitor(session, alliance_id, game_account_id)

        session.add.assert_called_once()
        session.commit.assert_called_once()
        assert result.alliance_id == alliance_id
        assert result.game_account_id == game_account_id

    @pytest.mark.asyncio
    async def test_raises_409_when_visitor_cap_reached(self, mocker):
        session = _mock_session(mocker)

        # Mock for find_visitor (returns None) and count_visitors (returns MAX=10)
        find_result_mock = mocker.MagicMock()
        find_result_mock.first.return_value = None

        count_result_mock = mocker.MagicMock()
        count_result_mock.one.return_value = 10

        session.exec = mocker.AsyncMock(side_effect=[find_result_mock, count_result_mock])

        with pytest.raises(HTTPException) as exc:
            await AllianceVisitorService.create_visitor(session, uuid.uuid4(), uuid.uuid4())
        assert exc.value.status_code == 409


# =========================================================================
# remove_visitor
# =========================================================================


class TestRemoveVisitor:
    @pytest.mark.asyncio
    async def test_raises_404_when_not_found(self, mocker):
        session = _mock_session(mocker)
        result_mock = mocker.MagicMock()
        result_mock.first.return_value = None
        session.exec.return_value = result_mock

        with pytest.raises(HTTPException) as exc:
            await AllianceVisitorService.remove_visitor(session, uuid.uuid4(), uuid.uuid4())
        assert exc.value.status_code == 404

    @pytest.mark.asyncio
    async def test_deletes_when_found(self, mocker):
        session = _mock_session(mocker)
        visitor = _make_visitor()
        result_mock = mocker.MagicMock()
        result_mock.first.return_value = visitor
        session.exec.return_value = result_mock

        await AllianceVisitorService.remove_visitor(session, uuid.uuid4(), uuid.uuid4())
        session.delete.assert_called_once_with(visitor)
        session.commit.assert_called_once()


# =========================================================================
# remove_if_visitor
# =========================================================================


class TestRemoveIfVisitor:
    @pytest.mark.asyncio
    async def test_does_nothing_when_not_found(self, mocker):
        session = _mock_session(mocker)
        result_mock = mocker.MagicMock()
        result_mock.first.return_value = None
        session.exec.return_value = result_mock

        # Should not raise
        await AllianceVisitorService.remove_if_visitor(session, uuid.uuid4(), uuid.uuid4())
        session.delete.assert_not_called()

    @pytest.mark.asyncio
    async def test_deletes_when_found(self, mocker):
        session = _mock_session(mocker)
        visitor = _make_visitor()
        result_mock = mocker.MagicMock()
        result_mock.first.return_value = visitor
        session.exec.return_value = result_mock

        await AllianceVisitorService.remove_if_visitor(session, uuid.uuid4(), uuid.uuid4())
        session.delete.assert_called_once_with(visitor)
        session.commit.assert_called_once()


# =========================================================================
# get_visitors
# =========================================================================


class TestGetVisitors:
    @pytest.mark.asyncio
    async def test_returns_all_visitors(self, mocker):
        session = _mock_session(mocker)
        alliance_id = uuid.uuid4()
        visitors = [_make_visitor(alliance_id=alliance_id), _make_visitor(alliance_id=alliance_id)]
        result_mock = mocker.MagicMock()
        result_mock.all.return_value = visitors
        session.exec.return_value = result_mock

        result = await AllianceVisitorService.get_visitors(session, alliance_id)
        assert len(result) == 2

    @pytest.mark.asyncio
    async def test_returns_empty_when_none(self, mocker):
        session = _mock_session(mocker)
        result_mock = mocker.MagicMock()
        result_mock.all.return_value = []
        session.exec.return_value = result_mock

        result = await AllianceVisitorService.get_visitors(session, uuid.uuid4())
        assert result == []


# =========================================================================
# get_visited_alliances
# =========================================================================


class TestGetVisitedAlliances:
    @pytest.mark.asyncio
    async def test_returns_empty_when_no_accounts(self, mocker):
        session = _mock_session(mocker)
        accounts_mock = mocker.MagicMock()
        accounts_mock.all.return_value = []
        session.exec.return_value = accounts_mock

        result = await AllianceVisitorService.get_visited_alliances(session, uuid.uuid4())
        assert result == []

    @pytest.mark.asyncio
    async def test_returns_visited_alliances(self, mocker):
        from src.models.GameAccount import GameAccount

        session = _mock_session(mocker)
        user_id = uuid.uuid4()
        acc = GameAccount(id=uuid.uuid4(), user_id=user_id, game_pseudo="TestAcc")
        visitor = _make_visitor(game_account_id=acc.id)

        accounts_mock = mocker.MagicMock()
        accounts_mock.all.return_value = [acc]

        visits_mock = mocker.MagicMock()
        visits_mock.all.return_value = [visitor]

        session.exec = mocker.AsyncMock(side_effect=[accounts_mock, visits_mock])

        result = await AllianceVisitorService.get_visited_alliances(session, user_id)
        assert len(result) == 1
        assert result[0].game_account_id == acc.id

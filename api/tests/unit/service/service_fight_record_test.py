"""Unit tests for FightRecordService.get_accessible_alliance_ids.

Why mocks instead of SQLite (load_objects / sqlite_async_engine)?
- Alliance.owner_id → game_account.id and GameAccount.alliance_id → alliance.id
  create a circular FK that requires careful multi-step insertion (disable FK checks,
  insert half-formed rows, patch FKs after commit). No existing unit test does this.
- These tests exercise the set-union logic (member_ids | visitor_ids), not the SQL
  join/filter expressions. SQL correctness is covered by the integration test suite.
- If a dedicated SQLite unit-test helper for circular-FK models is ever introduced,
  migrate these tests at that point.
"""

import uuid

import pytest

from src.services.knowledge.FightRecordService import FightRecordService

USER_ID = uuid.uuid4()
ALLIANCE_A_ID = uuid.uuid4()
ALLIANCE_B_ID = uuid.uuid4()


def _mock_session(mocker):
    session = mocker.AsyncMock()
    session.add = mocker.MagicMock()
    return session


def _exec_result(mocker, values):
    result = mocker.MagicMock()
    result.all.return_value = values
    return result


class TestGetAccessibleAllianceIds:
    @pytest.mark.asyncio
    async def test_returns_own_alliance_when_member(self, mocker):
        session = _mock_session(mocker)
        session.exec = mocker.AsyncMock(
            side_effect=[
                _exec_result(mocker, [ALLIANCE_A_ID]),  # member query
                _exec_result(mocker, []),  # visitor query
            ]
        )

        result = await FightRecordService.get_accessible_alliance_ids(session, USER_ID)

        assert ALLIANCE_A_ID in result

    @pytest.mark.asyncio
    async def test_returns_visited_alliance_when_visitor(self, mocker):
        session = _mock_session(mocker)
        session.exec = mocker.AsyncMock(
            side_effect=[
                _exec_result(mocker, []),  # member query
                _exec_result(mocker, [ALLIANCE_A_ID]),  # visitor query
            ]
        )

        result = await FightRecordService.get_accessible_alliance_ids(session, USER_ID)

        assert ALLIANCE_A_ID in result

    @pytest.mark.asyncio
    async def test_returns_both_when_member_and_visitor(self, mocker):
        session = _mock_session(mocker)
        session.exec = mocker.AsyncMock(
            side_effect=[
                _exec_result(mocker, [ALLIANCE_A_ID]),  # member query
                _exec_result(mocker, [ALLIANCE_B_ID]),  # visitor query
            ]
        )

        result = await FightRecordService.get_accessible_alliance_ids(session, USER_ID)

        assert ALLIANCE_A_ID in result
        assert ALLIANCE_B_ID in result

    @pytest.mark.asyncio
    async def test_returns_empty_when_no_alliance(self, mocker):
        session = _mock_session(mocker)
        session.exec = mocker.AsyncMock(
            side_effect=[
                _exec_result(mocker, []),  # member query
                _exec_result(mocker, []),  # visitor query
            ]
        )

        result = await FightRecordService.get_accessible_alliance_ids(session, USER_ID)

        assert result == []

    @pytest.mark.asyncio
    async def test_deduplicates_same_alliance_appearing_in_both_queries(self, mocker):
        # When the same alliance_id is returned by both the member query and the
        # visitor query, the set-union must contain it exactly once.
        session = _mock_session(mocker)
        session.exec = mocker.AsyncMock(
            side_effect=[
                _exec_result(mocker, [ALLIANCE_A_ID]),  # member query
                _exec_result(mocker, [ALLIANCE_A_ID]),  # visitor query — same ID
            ]
        )

        result = await FightRecordService.get_accessible_alliance_ids(session, USER_ID)

        assert len(result) == 1
        assert ALLIANCE_A_ID in result

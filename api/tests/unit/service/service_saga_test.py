"""Unit tests for SagaService using mocked sessions.

The project's unit-test convention for service-layer tests (see
tests/unit/service/service_champion_test.py) mocks the async DB session with
``mocker.AsyncMock()`` rather than hitting a real database — there is no real
``session`` fixture available at unit scope (only tests/integration/conftest.py
provides one, backed by a live test DB, for HTTP-level integration tests). This
file follows that existing convention instead of inventing a new one.
"""

import uuid

import pytest

from src.enums.SeasonFormat import SeasonFormat
from src.models.Season import Season
from src.services.admin.SagaService import SagaService
from src.services.admin.SeasonService import SeasonService


def _mock_session(mocker):
    """Return an AsyncMock pretending to be an async DB session."""
    session = mocker.AsyncMock()
    session.add = mocker.MagicMock()
    return session


@pytest.mark.asyncio
async def test_upsert_then_resolve_current(mocker):
    session = _mock_session(mocker)
    champion_id = uuid.uuid4()
    season = Season(id=uuid.uuid4(), number=42, format=SeasonFormat.regular)
    mocker.patch.object(SeasonService, "get_current_season", return_value=season)

    # upsert_role: no existing role -> create
    no_existing = mocker.MagicMock()
    no_existing.first.return_value = None
    session.exec.return_value = no_existing

    role = await SagaService.upsert_role(session, season.id, champion_id, True, False)
    assert role.is_saga_attacker is True
    assert role.is_saga_defender is False

    # resolve_current: get_roles_for_season returns the created role
    with_role = mocker.MagicMock()
    with_role.all.return_value = [role]
    session.exec.return_value = with_role

    roles = await SagaService.resolve_current(session)
    assert roles[champion_id] == (True, False)

    # update path: existing role found -> updated in place
    existing = mocker.MagicMock()
    existing.first.return_value = role
    session.exec.return_value = existing

    updated_role = await SagaService.upsert_role(session, season.id, champion_id, True, True)
    assert updated_role is role
    assert updated_role.is_saga_attacker is True
    assert updated_role.is_saga_defender is True

    with_updated_role = mocker.MagicMock()
    with_updated_role.all.return_value = [updated_role]
    session.exec.return_value = with_updated_role

    roles = await SagaService.resolve_current(session)
    assert roles[champion_id] == (True, True)


@pytest.mark.asyncio
async def test_resolve_current_empty_without_season(mocker):
    session = _mock_session(mocker)
    mocker.patch.object(SeasonService, "get_current_season", return_value=None)

    assert await SagaService.resolve_current(session) == {}

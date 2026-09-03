"""Integration tests for the alliance strategist rank."""

import pytest
from fastapi import HTTPException
from sqlmodel import select

from main import app
from src.models.alliance.AllianceStrategist import AllianceStrategist
from src.services.alliance.AllianceService import AllianceService
from src.utils.db import get_session
from tests.integration.endpoints.setup.game_setup import (
    push_alliance_with_owner,
    push_member,
    push_officer,
    push_strategist,
)
from tests.integration.endpoints.setup.user_setup import get_generic_user
from tests.utils.utils_client import create_auth_headers
from tests.utils.utils_constant import (
    DISCORD_ID_2,
    GAME_PSEUDO_2,
    USER2_EMAIL,
    USER2_ID,
    USER2_LOGIN,
    USER_ID,
)
from tests.utils.utils_db import get_test_session, load_objects

app.dependency_overrides[get_session] = get_test_session

HEADERS_USER1 = create_auth_headers(user_id=str(USER_ID))
HEADERS_USER2 = create_auth_headers(user_id=str(USER2_ID))

ENDPOINT = "/alliances"


async def _setup_2_users():
    """Insert two standard test users."""
    u1 = get_generic_user(is_base_id=True)
    u2 = get_generic_user(login=USER2_LOGIN, email=USER2_EMAIL)
    u2.id = USER2_ID
    u2.discord_id = DISCORD_ID_2
    await load_objects([u1, u2])


class TestStrategistModel:
    @pytest.mark.asyncio
    async def test_push_strategist_creates_a_row(self, session):
        await _setup_2_users()
        alliance, _owner = await push_alliance_with_owner()
        member = await push_member(alliance, USER2_ID, GAME_PSEUDO_2)

        await push_strategist(alliance, member)

        result = await session.exec(
            select(AllianceStrategist).where(
                AllianceStrategist.alliance_id == alliance.id,
                AllianceStrategist.game_account_id == member.id,
            )
        )
        row = result.first()
        assert row is not None
        assert row.assigned_at is not None


class TestCanPlace:
    @pytest.mark.asyncio
    async def test_strategist_can_place(self, session):
        await _setup_2_users()
        alliance, _owner = await push_alliance_with_owner()
        member = await push_member(alliance, USER2_ID, GAME_PSEUDO_2)
        await push_strategist(alliance, member)

        assert await AllianceService.can_place(session, USER2_ID, alliance.id) is True

    @pytest.mark.asyncio
    async def test_owner_can_place(self, session):
        await _setup_2_users()
        alliance, _owner = await push_alliance_with_owner()

        assert await AllianceService.can_place(session, USER_ID, alliance.id) is True

    @pytest.mark.asyncio
    async def test_officer_can_place(self, session):
        await _setup_2_users()
        alliance, _owner = await push_alliance_with_owner()
        member = await push_member(alliance, USER2_ID, GAME_PSEUDO_2)
        await push_officer(alliance, member)

        assert await AllianceService.can_place(session, USER2_ID, alliance.id) is True

    @pytest.mark.asyncio
    async def test_plain_member_cannot_place(self, session):
        await _setup_2_users()
        alliance, _owner = await push_alliance_with_owner()
        await push_member(alliance, USER2_ID, GAME_PSEUDO_2)

        assert await AllianceService.can_place(session, USER2_ID, alliance.id) is False

    @pytest.mark.asyncio
    async def test_require_strategist_raises_403_for_plain_member(self, session):
        await _setup_2_users()
        alliance, _owner = await push_alliance_with_owner()
        await push_member(alliance, USER2_ID, GAME_PSEUDO_2)

        with pytest.raises(HTTPException) as exc:
            await AllianceService.require_strategist(session, alliance.id, USER2_ID)
        assert exc.value.status_code == 403

    @pytest.mark.asyncio
    async def test_require_strategist_account_returns_the_strategist_account(self, session):
        await _setup_2_users()
        alliance, _owner = await push_alliance_with_owner()
        member = await push_member(alliance, USER2_ID, GAME_PSEUDO_2)
        await push_strategist(alliance, member)

        account = await AllianceService.require_strategist_account(session, alliance.id, USER2_ID)
        assert account.id == member.id

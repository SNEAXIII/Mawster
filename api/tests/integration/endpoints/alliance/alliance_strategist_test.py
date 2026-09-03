"""Integration tests for the alliance strategist rank."""

import pytest
from sqlmodel import select

from main import app
from src.models.alliance.AllianceStrategist import AllianceStrategist
from src.utils.db import get_session
from tests.integration.endpoints.setup.game_setup import (
    push_alliance_with_owner,
    push_member,
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

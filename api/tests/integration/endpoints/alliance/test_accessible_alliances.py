"""Integration tests for GET /alliances/accessible."""

import pytest

from tests.integration.endpoints.setup.game_setup import (
    push_alliance_with_owner,
    push_visitor,
)
from tests.integration.endpoints.setup.user_setup import get_generic_user, push_user2
from tests.utils.utils_client import create_auth_headers, execute_get_request
from tests.utils.utils_constant import (
    ALLIANCE_NAME,
    ALLIANCE_TAG,
    GAME_PSEUDO,
    GAME_PSEUDO_2,
    USER2_ID,
    USER_ID,
)
from tests.utils.utils_db import load_objects

ENDPOINT = "/alliances/accessible"
HEADERS_USER1 = create_auth_headers(user_id=str(USER_ID))
HEADERS_USER2 = create_auth_headers(user_id=str(USER2_ID))


class TestAccessibleAlliances:
    @pytest.mark.asyncio
    async def test_member_sees_own_alliance(self):
        """Member sees their own alliance in /alliances/accessible."""
        await load_objects([get_generic_user(is_base_id=True)])
        alliance, _owner = await push_alliance_with_owner(
            user_id=USER_ID,
            game_pseudo=GAME_PSEUDO,
            alliance_name=ALLIANCE_NAME,
            alliance_tag=ALLIANCE_TAG,
        )

        resp = await execute_get_request(ENDPOINT, headers=HEADERS_USER1)

        assert resp.status_code == 200
        ids = [a["id"] for a in resp.json()]
        assert str(alliance.id) in ids

    @pytest.mark.asyncio
    async def test_no_alliance_returns_empty(self):
        """User with no alliance or visitor link returns empty list."""
        await load_objects([get_generic_user(is_base_id=True)])

        resp = await execute_get_request(ENDPOINT, headers=HEADERS_USER1)

        assert resp.status_code == 200
        assert resp.json() == []

    @pytest.mark.asyncio
    async def test_visitor_sees_visited_alliance(self):
        """Visitor sees the visited alliance in /alliances/accessible."""
        await load_objects([get_generic_user(is_base_id=True)])
        alliance, _owner = await push_alliance_with_owner(
            user_id=USER_ID,
            game_pseudo=GAME_PSEUDO,
            alliance_name=ALLIANCE_NAME,
            alliance_tag=ALLIANCE_TAG,
        )
        await push_user2()
        await push_visitor(alliance=alliance, user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)

        resp = await execute_get_request(ENDPOINT, headers=HEADERS_USER2)

        assert resp.status_code == 200
        ids = [a["id"] for a in resp.json()]
        assert str(alliance.id) in ids

    @pytest.mark.asyncio
    async def test_no_duplicates_for_member(self):
        """User who is a member sees the alliance exactly once (no duplicate from visited path)."""
        await load_objects([get_generic_user(is_base_id=True)])
        alliance, _owner = await push_alliance_with_owner(
            user_id=USER_ID,
            game_pseudo=GAME_PSEUDO,
            alliance_name=ALLIANCE_NAME,
            alliance_tag=ALLIANCE_TAG,
        )

        resp = await execute_get_request(ENDPOINT, headers=HEADERS_USER1)

        assert resp.status_code == 200
        ids = [a["id"] for a in resp.json()]
        assert ids.count(str(alliance.id)) == 1

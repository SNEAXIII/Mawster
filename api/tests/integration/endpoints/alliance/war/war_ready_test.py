"""Integration tests for opening a battlegroup's attacks."""

import pytest

from tests.integration.endpoints.setup.game_setup import push_strategist
from tests.integration.endpoints.setup.war_setup import _setup_war
from tests.utils.utils_client import (
    create_auth_headers,
    execute_get_request,
    execute_post_request,
    execute_put_request,
)
from tests.utils.utils_constant import USER2_ID, USER_ID

OWNER = create_auth_headers(user_id=str(USER_ID))
MEMBER = create_auth_headers(user_id=str(USER2_ID))


def _bg_url(data, bg=1):
    return f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/{bg}"


async def _is_ready(data, bg=1):
    return (await execute_get_request(_bg_url(data, bg), headers=MEMBER)).json()["is_ready"]


class TestWarBgReady:
    @pytest.mark.asyncio
    async def test_starts_red(self):
        data = await _setup_war()
        assert await _is_ready(data) is False

    @pytest.mark.asyncio
    async def test_toggle_green_then_red_is_seen_by_members(self):
        data = await _setup_war()
        response = await execute_put_request(
            f"{_bg_url(data)}/ready", payload={"ready": True}, headers=OWNER
        )
        assert response.status_code == 200
        assert response.json() == {"ready": True}
        assert await _is_ready(data) is True
        assert await _is_ready(data, bg=2) is False

        await execute_put_request(f"{_bg_url(data)}/ready", payload={"ready": False}, headers=OWNER)
        assert await _is_ready(data) is False

    @pytest.mark.asyncio
    async def test_setting_green_twice_is_idempotent(self):
        data = await _setup_war()
        for _ in range(2):
            response = await execute_put_request(
                f"{_bg_url(data)}/ready", payload={"ready": True}, headers=OWNER
            )
            assert response.status_code == 200
        assert await _is_ready(data) is True

    @pytest.mark.asyncio
    async def test_strategist_can_toggle(self):
        data = await _setup_war()
        await push_strategist(data["alliance"], data["member"])
        response = await execute_put_request(
            f"{_bg_url(data)}/ready", payload={"ready": True}, headers=MEMBER
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_plain_member_forbidden(self):
        data = await _setup_war()
        response = await execute_put_request(
            f"{_bg_url(data)}/ready", payload={"ready": True}, headers=MEMBER
        )
        assert response.status_code == 403
        assert await _is_ready(data) is False

    @pytest.mark.asyncio
    async def test_closed_war_rejected(self):
        data = await _setup_war()
        await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/end",
            payload={"win": True},
            headers=OWNER,
        )
        response = await execute_put_request(
            f"{_bg_url(data)}/ready", payload={"ready": True}, headers=OWNER
        )
        assert response.status_code == 409

"""What a strategist may and may not write."""

import pytest

from main import app
from src.utils.db import get_session
from tests.integration.endpoints.setup.game_setup import (
    push_alliance_with_owner,
    push_champion,
    push_champion_user,
    push_member,
    push_strategist,
)
from tests.integration.endpoints.setup.user_setup import get_generic_user
from tests.utils.utils_client import (
    create_auth_headers,
    execute_delete_request,
    execute_get_request,
    execute_post_request,
)
from tests.utils.utils_constant import (
    DISCORD_ID_2,
    GAME_PSEUDO_2,
    USER2_EMAIL,
    USER2_ID,
    USER2_LOGIN,
)
from tests.utils.utils_db import get_test_session, load_objects

app.dependency_overrides[get_session] = get_test_session

HEADERS_USER2 = create_auth_headers(user_id=str(USER2_ID))

ENDPOINT = "/alliances"


async def _setup_strategist():
    """Alliance with an owner plus one strategist in battlegroup 1.

    Returns (alliance, strategist_account, one of their roster entries)."""
    u1 = get_generic_user(is_base_id=True)
    u2 = get_generic_user(login=USER2_LOGIN, email=USER2_EMAIL)
    u2.id = USER2_ID
    u2.discord_id = DISCORD_ID_2
    await load_objects([u1, u2])

    alliance, _owner = await push_alliance_with_owner()
    member = await push_member(alliance, USER2_ID, GAME_PSEUDO_2)
    member.alliance_group = 1
    await load_objects([member])
    await push_strategist(alliance, member)

    champion = await push_champion(name="Hulk", champion_class="Science")
    roster_entry = await push_champion_user(member, champion)
    return alliance, member, roster_entry


class TestStrategistDefenseAssignment:
    @pytest.mark.asyncio
    async def test_strategist_places_a_defender_for_another_player(self):
        """The strategist is the requester; the defender belongs to a
        teammate, not to the strategist's own account — this exercises the
        `is_manager` branch of `place_defender`, not the self-placement one."""
        alliance, _member, _roster_entry = await _setup_strategist()

        teammate_user = get_generic_user(login="teammate", email="teammate@example.com")
        teammate_user.discord_id = "discord_teammate"
        await load_objects([teammate_user])
        teammate = await push_member(alliance, teammate_user.id, "Teammate")
        teammate.alliance_group = 1
        await load_objects([teammate])
        champion = await push_champion(name="Iron Man", champion_class="Tech")
        teammate_roster_entry = await push_champion_user(teammate, champion)

        response = await execute_post_request(
            f"{ENDPOINT}/{alliance.id}/defense/bg/1/place",
            payload={
                "node_number": 1,
                "champion_user_id": str(teammate_roster_entry.id),
                "game_account_id": str(teammate.id),
            },
            headers=HEADERS_USER2,
        )

        assert response.status_code in (200, 201)

    @pytest.mark.asyncio
    async def test_strategist_clears_a_battlegroup(self):
        alliance, _member, _roster_entry = await _setup_strategist()

        response = await execute_delete_request(
            f"{ENDPOINT}/{alliance.id}/defense/bg/1/clear",
            headers=HEADERS_USER2,
        )

        assert response.status_code in (200, 204)


class TestStrategistStaysOutOfManagement:
    @pytest.mark.asyncio
    async def test_strategist_cannot_invite(self):
        alliance, _member, _roster_entry = await _setup_strategist()

        response = await execute_post_request(
            f"{ENDPOINT}/{alliance.id}/invitations",
            payload={"game_account_id": str(_member.id)},
            headers=HEADERS_USER2,
        )

        assert response.status_code == 403


class TestBgMemberPayload:
    @pytest.mark.asyncio
    async def test_bg_members_carry_the_strategist_flag(self):
        alliance, member, _roster_entry = await _setup_strategist()

        response = await execute_get_request(
            f"{ENDPOINT}/{alliance.id}/defense/bg/1/members",
            headers=HEADERS_USER2,
        )

        assert response.status_code == 200
        row = next(m for m in response.json() if m["game_account_id"] == str(member.id))
        assert row["is_strategist"] is True
        assert row["is_officer"] is False

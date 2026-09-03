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
from tests.integration.endpoints.setup.war_setup import _setup_war
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
    USER_ID,
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


async def _push_teammate(alliance):
    """Add a second, unrelated game account (with its own User row) to
    battlegroup 1.

    Used wherever a test needs a genuine second player distinct from the
    strategist, so the request exercises the "acting for someone else"
    guard branch instead of accidentally passing via self-placement."""
    teammate_user = get_generic_user(login="teammate", email="teammate@example.com")
    teammate_user.discord_id = "discord_teammate"
    await load_objects([teammate_user])
    teammate = await push_member(alliance, teammate_user.id, "Teammate")
    teammate.alliance_group = 1
    await load_objects([teammate])
    return teammate


class TestStrategistDefenseAssignment:
    @pytest.mark.asyncio
    async def test_strategist_places_a_defender_for_another_player(self):
        """The strategist is the requester; the defender belongs to a
        teammate, not to the strategist's own account — this exercises the
        `is_manager` branch of `place_defender`, not the self-placement one."""
        alliance, _member, _roster_entry = await _setup_strategist()

        teammate = await _push_teammate(alliance)
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

    @pytest.mark.asyncio
    async def test_strategist_removes_a_defender(self):
        """A bare strategist (no officer row) removes a placement — this
        exercises `remove_defender`'s guard specifically, not just `place`."""
        alliance, member, roster_entry = await _setup_strategist()

        # Self-placement is open to any member regardless of rank, so this
        # setup step alone doesn't exercise the guard under test — only the
        # DELETE below does.
        await execute_post_request(
            f"{ENDPOINT}/{alliance.id}/defense/bg/1/place",
            payload={
                "node_number": 1,
                "champion_user_id": str(roster_entry.id),
                "game_account_id": str(member.id),
            },
            headers=HEADERS_USER2,
        )

        response = await execute_delete_request(
            f"{ENDPOINT}/{alliance.id}/defense/bg/1/node/1",
            headers=HEADERS_USER2,
        )

        assert response.status_code == 204


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


class TestStrategistWarPlacement:
    """The war-map placement family: `place_war_defender` is the one call site
    using the structurally different `require_strategist_account` — a plain
    guard-inspection pass would not catch it regressing to officer-only."""

    @pytest.mark.asyncio
    async def test_bare_strategist_places_a_war_defender(self):
        """Would fail (403 instead of 201) if `place_war_defender` reverted
        to `assert_officer_or_owner_by_id` / dropped the strategist branch of
        `require_strategist_account`."""
        data = await _setup_war()
        await push_strategist(data["alliance"], data["member"])
        headers = create_auth_headers(user_id=str(USER2_ID))

        response = await execute_post_request(
            f"{ENDPOINT}/{data['alliance'].id}/wars/{data['war'].id}/bg/1/place",
            payload={
                "node_number": 10,
                "champion_id": str(data["champ"].id),
                "stars": 7,
                "rank": 3,
                "ascension": 0,
            },
            headers=headers,
        )

        assert response.status_code == 201

    @pytest.mark.asyncio
    async def test_bare_strategist_removes_a_war_defender(self):
        """Would fail (403 instead of 204) if `remove_war_defender` reverted
        to `require_officer`."""
        data = await _setup_war()
        await push_strategist(data["alliance"], data["member"])
        owner_headers = create_auth_headers(user_id=str(USER_ID))
        strategist_headers = create_auth_headers(user_id=str(USER2_ID))

        await execute_post_request(
            f"{ENDPOINT}/{data['alliance'].id}/wars/{data['war'].id}/bg/1/place",
            payload={
                "node_number": 10,
                "champion_id": str(data["champ"].id),
                "stars": 7,
                "rank": 3,
                "ascension": 0,
            },
            headers=owner_headers,
        )

        response = await execute_delete_request(
            f"{ENDPOINT}/{data['alliance'].id}/wars/{data['war'].id}/bg/1/node/10",
            headers=strategist_headers,
        )

        assert response.status_code == 204

    @pytest.mark.asyncio
    async def test_bare_strategist_clears_the_war_battlegroup(self):
        """Would fail (403 instead of 200) if `clear_war_bg` reverted to
        `require_officer`."""
        data = await _setup_war()
        await push_strategist(data["alliance"], data["member"])
        owner_headers = create_auth_headers(user_id=str(USER_ID))
        strategist_headers = create_auth_headers(user_id=str(USER2_ID))

        await execute_post_request(
            f"{ENDPOINT}/{data['alliance'].id}/wars/{data['war'].id}/bg/1/place",
            payload={
                "node_number": 10,
                "champion_id": str(data["champ"].id),
                "stars": 7,
                "rank": 3,
                "ascension": 0,
            },
            headers=owner_headers,
        )

        response = await execute_delete_request(
            f"{ENDPOINT}/{data['alliance'].id}/wars/{data['war'].id}/bg/1/clear",
            headers=strategist_headers,
        )

        assert response.status_code == 200
        assert response.json()["deleted"] == 1

    @pytest.mark.asyncio
    async def test_plain_member_cannot_place_a_war_defender(self):
        """No officer row, no strategist row — proves the guard actually
        rejects, not just that it's open to any alliance member. Would fail
        (201 instead of 403) if the guard regressed to `require_member` or
        was dropped."""
        data = await _setup_war()
        headers = create_auth_headers(user_id=str(USER2_ID))

        response = await execute_post_request(
            f"{ENDPOINT}/{data['alliance'].id}/wars/{data['war'].id}/bg/1/place",
            payload={
                "node_number": 10,
                "champion_id": str(data["champ"].id),
                "stars": 7,
                "rank": 3,
                "ascension": 0,
            },
            headers=headers,
        )

        assert response.status_code == 403

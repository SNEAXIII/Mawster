"""Integration tests for war placement endpoints."""

import uuid

import pytest

from tests.utils.utils_client import (
    create_auth_headers,
    execute_get_request,
    execute_post_request,
    execute_delete_request,
    execute_patch_request,
)
from tests.utils.utils_constant import (
    USER_ID,
    USER2_ID,
    GAME_PSEUDO,
    GAME_PSEUDO_2,
    ALLIANCE_NAME,
    ALLIANCE_TAG,
)
from tests.integration.endpoints.setup.game_setup import (
    push_alliance_with_owner,
    push_member,
    push_officer,
    push_champion,
    push_champion_user,
)
from tests.integration.endpoints.setup.user_setup import get_generic_user, push_user2
from tests.utils.utils_db import load_objects
from src.models.War import War

USER3_ID = uuid.UUID("00000000-0000-0000-0000-000000000003")

OPPONENT = "Enemy Alliance"


# ─── Helpers ──────────────────────────────────────────────


async def _setup_alliance(
    owner_user_id=USER_ID,
    member_user_id=USER2_ID,
):
    """Create alliance + owner (officer) + member + champion. No war."""
    await load_objects([get_generic_user(is_base_id=True)])
    await push_user2()

    alliance, owner = await push_alliance_with_owner(
        user_id=owner_user_id,
        game_pseudo=GAME_PSEUDO,
        alliance_name=ALLIANCE_NAME,
        alliance_tag=ALLIANCE_TAG,
    )
    await push_officer(alliance, owner)

    member = await push_member(alliance, user_id=member_user_id, game_pseudo=GAME_PSEUDO_2)

    champ = await push_champion(name="Spider-Man", champion_class="Science")

    return {
        "alliance": alliance,
        "owner": owner,
        "member": member,
        "champ": champ,
    }


async def _setup_war(
    owner_user_id=USER_ID,
    member_user_id=USER2_ID,
):
    """Create alliance + owner (officer) + member + champion + one declared war."""
    data = await _setup_alliance(owner_user_id, member_user_id)

    war = War(
        id=uuid.uuid4(),
        alliance_id=data["alliance"].id,
        opponent_name=OPPONENT,
        created_by_id=data["owner"].id,
    )
    await load_objects([war])

    return {**data, "war": war}


# ─── Attacker helpers ─────────────────────────────────────


async def _setup_attacker_scenario():
    """
    Create alliance + owner (officer, BG1) + member (BG1) + champion + war + defender on node 10.
    Returns dict with all objects needed for attacker tests.
    """
    data = await _setup_alliance()
    alliance = data["alliance"]
    owner = data["owner"]
    member = data["member"]
    champ = data["champ"]

    headers_owner = create_auth_headers(user_id=str(USER_ID))
    await execute_patch_request(
        f"/alliances/{alliance.id}/members/{owner.id}/group",
        payload={"group": 1},
        headers=headers_owner,
    )
    await execute_patch_request(
        f"/alliances/{alliance.id}/members/{member.id}/group",
        payload={"group": 1},
        headers=headers_owner,
    )

    war = War(
        id=uuid.uuid4(),
        alliance_id=alliance.id,
        opponent_name=OPPONENT,
        created_by_id=owner.id,
    )
    await load_objects([war])

    await execute_post_request(
        f"/alliances/{alliance.id}/wars/{war.id}/bg/1/place",
        payload={
            "node_number": 10,
            "champion_id": str(champ.id),
            "stars": 7,
            "rank": 3,
            "ascension": 0,
        },
        headers=headers_owner,
    )

    champ2 = await push_champion(name="Wolverine", champion_class="Mutant")
    cu = await push_champion_user(member, champ2, stars=7, rank=3)

    return {
        **data,
        "war": war,
        "champ2": champ2,
        "champion_user": cu,
    }


class TestPlaceWarDefender:
    @pytest.mark.asyncio
    async def test_place_defender_success(self):
        data = await _setup_war()
        headers = create_auth_headers(user_id=str(USER_ID))

        response = await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/1/place",
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
        body = response.json()
        assert body["node_number"] == 10
        assert body["champion_name"] == "Spider-Man"
        assert body["rarity"] == "7r3"
        assert body["ascension"] == 0

    @pytest.mark.asyncio
    async def test_place_defender_same_champion_multiple_nodes(self):
        data = await _setup_war()
        headers = create_auth_headers(user_id=str(USER_ID))
        url = f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/1/place"

        await execute_post_request(
            url,
            payload={
                "node_number": 10,
                "champion_id": str(data["champ"].id),
                "stars": 7,
                "rank": 3,
                "ascension": 0,
            },
            headers=headers,
        )
        # Same champion on a different node → allowed
        response = await execute_post_request(
            url,
            payload={
                "node_number": 11,
                "champion_id": str(data["champ"].id),
                "stars": 7,
                "rank": 3,
                "ascension": 0,
            },
            headers=headers,
        )
        assert response.status_code == 201

    @pytest.mark.asyncio
    async def test_place_defender_replaces_node(self):
        data = await _setup_war()
        headers = create_auth_headers(user_id=str(USER_ID))
        champ2 = await push_champion(name="Wolverine", champion_class="Mutant")
        url = f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/1/place"

        await execute_post_request(
            url,
            payload={
                "node_number": 10,
                "champion_id": str(data["champ"].id),
                "stars": 7,
                "rank": 3,
                "ascension": 0,
            },
            headers=headers,
        )
        # Different champion, same node → replaces
        response = await execute_post_request(
            url,
            payload={
                "node_number": 10,
                "champion_id": str(champ2.id),
                "stars": 6,
                "rank": 5,
                "ascension": 0,
            },
            headers=headers,
        )
        assert response.status_code == 201
        assert response.json()["champion_name"] == "Wolverine"

    @pytest.mark.asyncio
    async def test_place_defender_non_officer_forbidden(self):
        data = await _setup_war()
        headers = create_auth_headers(user_id=str(USER2_ID))

        response = await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/1/place",
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

    @pytest.mark.asyncio
    async def test_clear_bg(self):
        data = await _setup_war()
        headers = create_auth_headers(user_id=str(USER_ID))
        url_place = f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/1/place"

        await execute_post_request(
            url_place,
            payload={
                "node_number": 10,
                "champion_id": str(data["champ"].id),
                "stars": 7,
                "rank": 3,
                "ascension": 0,
            },
            headers=headers,
        )
        response = await execute_delete_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/1/clear",
            headers=headers,
        )
        assert response.status_code == 200
        assert response.json()["deleted"] == 1

    @pytest.mark.asyncio
    async def test_place_defender_unknown_champion_returns_404(self):
        data = await _setup_war()
        headers = create_auth_headers(user_id=str(USER_ID))
        resp = await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/1/place",
            payload={
                "node_number": 5,
                "champion_id": str(uuid.uuid4()),
                "stars": 7,
                "rank": 3,
                "ascension": 0,
            },
            headers=headers,
        )
        assert resp.status_code == 404


# ─── TestRemoveWarDefender ────────────────────────────────


class TestRemoveWarDefender:
    @pytest.mark.asyncio
    async def test_remove_defender_success(self):
        data = await _setup_war()
        headers = create_auth_headers(user_id=str(USER_ID))

        await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/1/place",
            payload={
                "node_number": 10,
                "champion_id": str(data["champ"].id),
                "stars": 7,
                "rank": 3,
                "ascension": 0,
            },
            headers=headers,
        )
        response = await execute_delete_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/1/node/10",
            headers=headers,
        )
        assert response.status_code == 204

    @pytest.mark.asyncio
    async def test_remove_defender_not_found(self):
        data = await _setup_war()
        headers = create_auth_headers(user_id=str(USER_ID))

        response = await execute_delete_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/1/node/99",
            headers=headers,
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_remove_defender_non_officer_forbidden(self):
        data = await _setup_war()
        headers = create_auth_headers(user_id=str(USER2_ID))

        response = await execute_delete_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/1/node/10",
            headers=headers,
        )
        assert response.status_code == 403


# ─── TestCreateWarStatus ──────────────────────────────────


class TestWarBans:
    @pytest.mark.asyncio
    async def test_create_war_with_bans_returns_banned_champions(self):
        """War created with bans returns banned_champions in the response."""
        data = await _setup_alliance()
        headers = create_auth_headers(user_id=str(USER_ID))
        champ2 = await push_champion(name="Thor", champion_class="Cosmic")

        response = await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars",
            payload={
                "opponent_name": "Banned Enemy",
                "banned_champion_ids": [str(data["champ"].id), str(champ2.id)],
            },
            headers=headers,
        )
        assert response.status_code == 201
        body = response.json()
        assert "banned_champions" in body
        banned_names = [c["name"] for c in body["banned_champions"]]
        assert "Spider-Man" in banned_names
        assert "Thor" in banned_names

    @pytest.mark.asyncio
    async def test_create_war_without_bans_returns_empty_list(self):
        """War created without bans returns empty banned_champions."""
        data = await _setup_alliance()
        headers = create_auth_headers(user_id=str(USER_ID))

        response = await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars",
            payload={"opponent_name": "No Bans Enemy"},
            headers=headers,
        )
        assert response.status_code == 201
        assert response.json()["banned_champions"] == []

    @pytest.mark.asyncio
    async def test_create_war_with_6_bans_rejected(self):
        """More than 6 bans is rejected."""
        data = await _setup_alliance()
        headers = create_auth_headers(user_id=str(USER_ID))
        extra_champs = []
        for i, (name, cls) in enumerate(
            [
                ("Thor", "Cosmic"),
                ("Iron Man", "Tech"),
                ("Hulk", "Science"),
                ("Black Widow", "Skill"),
                ("Vision", "Tech"),
                ("Wolverine", "Mutant"),
            ]
        ):
            extra_champs.append(await push_champion(name=name, champion_class=cls))

        response = await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars",
            payload={
                "opponent_name": "Too Many Bans",
                "banned_champion_ids": [str(data["champ"].id)] + [str(c.id) for c in extra_champs],
            },
            headers=headers,
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_create_war_with_duplicate_bans_rejected(self):
        """Duplicate champion in ban list is rejected."""
        data = await _setup_alliance()
        headers = create_auth_headers(user_id=str(USER_ID))

        response = await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars",
            payload={
                "opponent_name": "Duplicate Bans",
                "banned_champion_ids": [str(data["champ"].id), str(data["champ"].id)],
            },
            headers=headers,
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_create_war_with_nonexistent_champion_rejected(self):
        """Unknown champion id in bans returns 404."""
        data = await _setup_alliance()
        headers = create_auth_headers(user_id=str(USER_ID))

        response = await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars",
            payload={
                "opponent_name": "Ghost Ban",
                "banned_champion_ids": [str(uuid.uuid4())],
            },
            headers=headers,
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_available_attackers_excludes_banned_champion(self):
        """A champion banned in the war must not appear in available attackers."""
        data = await _setup_attacker_scenario()
        headers_officer = create_auth_headers(user_id=str(USER_ID))
        headers_member = create_auth_headers(user_id=str(USER2_ID))

        # End current war, create a new one banning Wolverine (champ2 = data["champ2"])
        await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/end",
            payload={"win": True},
            headers=headers_officer,
        )
        new_war_resp = await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars",
            payload={
                "opponent_name": "Ban War",
                "banned_champion_ids": [str(data["champ2"].id)],
            },
            headers=headers_officer,
        )
        assert new_war_resp.status_code == 201
        new_war_id = new_war_resp.json()["id"]

        response = await execute_get_request(
            f"/alliances/{data['alliance'].id}/wars/{new_war_id}/bg/1/available-attackers",
            headers=headers_member,
        )
        assert response.status_code == 200
        names = [a["champion_name"] for a in response.json()]
        assert "Wolverine" not in names

    @pytest.mark.asyncio
    async def test_assign_attacker_banned_champion_rejected(self):
        """Assigning a banned champion as attacker is rejected with 409."""
        data = await _setup_attacker_scenario()
        headers_officer = create_auth_headers(user_id=str(USER_ID))
        headers_member = create_auth_headers(user_id=str(USER2_ID))

        # End current war, create a new one banning Wolverine
        await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/end",
            payload={"win": True},
            headers=headers_officer,
        )
        new_war_resp = await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars",
            payload={
                "opponent_name": "Ban Attacker War",
                "banned_champion_ids": [str(data["champ2"].id)],
            },
            headers=headers_officer,
        )
        new_war_id = new_war_resp.json()["id"]

        # Place a defender on node 10 in the new war
        await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars/{new_war_id}/bg/1/place",
            payload={
                "node_number": 10,
                "champion_id": str(data["champ"].id),
                "stars": 7,
                "rank": 3,
                "ascension": 0,
            },
            headers=headers_officer,
        )

        # Try to assign banned Wolverine as attacker
        response = await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars/{new_war_id}/bg/1/node/10/attacker",
            payload={"champion_user_id": str(data["champion_user"].id)},
            headers=headers_member,
        )
        assert response.status_code == 409


# ─── TestWarSeasonLink ────────────────────────────────────


class TestToggleCombatCompleted:
    """PATCH /alliances/{id}/wars/{id}/bg/{bg}/node/{node}/complete"""

    @pytest.mark.asyncio
    async def test_toggle_marks_combat_completed(self):
        data = await _setup_attacker_scenario()
        headers = create_auth_headers(user_id=str(USER2_ID))

        await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/1/node/10/attacker",
            payload={"champion_user_id": str(data["champion_user"].id)},
            headers=headers,
        )

        response = await execute_patch_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/1/node/10/complete",
            payload={},
            headers=headers,
        )
        assert response.status_code == 200
        assert response.json()["is_combat_completed"] is True

    @pytest.mark.asyncio
    async def test_toggle_twice_marks_combat_not_completed(self):
        data = await _setup_attacker_scenario()
        headers = create_auth_headers(user_id=str(USER2_ID))

        await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/1/node/10/attacker",
            payload={"champion_user_id": str(data["champion_user"].id)},
            headers=headers,
        )
        await execute_patch_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/1/node/10/complete",
            payload={},
            headers=headers,
        )
        response = await execute_patch_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/1/node/10/complete",
            payload={},
            headers=headers,
        )
        assert response.status_code == 200
        assert response.json()["is_combat_completed"] is False

    @pytest.mark.asyncio
    async def test_toggle_no_defender_returns_404(self):
        data = await _setup_attacker_scenario()
        headers = create_auth_headers(user_id=str(USER_ID))

        response = await execute_patch_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/1/node/20/complete",
            payload={},
            headers=headers,
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_toggle_no_attacker_returns_422(self):
        data = await _setup_attacker_scenario()
        headers = create_auth_headers(user_id=str(USER_ID))

        response = await execute_patch_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/1/node/10/complete",
            payload={},
            headers=headers,
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_assign_attacker_blocked_when_completed(self):
        data = await _setup_attacker_scenario()
        headers = create_auth_headers(user_id=str(USER2_ID))

        await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/1/node/10/attacker",
            payload={"champion_user_id": str(data["champion_user"].id)},
            headers=headers,
        )
        await execute_patch_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/1/node/10/complete",
            payload={},
            headers=headers,
        )

        champ2 = await push_champion(name="Thor", champion_class="Cosmic")
        cu2 = await push_champion_user(data["member"], champ2, stars=7, rank=3)

        response = await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/1/node/10/attacker",
            payload={"champion_user_id": str(cu2.id)},
            headers=headers,
        )
        assert response.status_code == 409

    @pytest.mark.asyncio
    async def test_remove_attacker_blocked_when_completed(self):
        data = await _setup_attacker_scenario()
        headers = create_auth_headers(user_id=str(USER2_ID))

        await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/1/node/10/attacker",
            payload={"champion_user_id": str(data["champion_user"].id)},
            headers=headers,
        )
        await execute_patch_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/1/node/10/complete",
            payload={},
            headers=headers,
        )

        response = await execute_delete_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/1/node/10/attacker",
            headers=headers,
        )
        assert response.status_code == 409

    @pytest.mark.asyncio
    async def test_update_ko_blocked_when_completed(self):
        data = await _setup_attacker_scenario()
        headers = create_auth_headers(user_id=str(USER2_ID))

        await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/1/node/10/attacker",
            payload={"champion_user_id": str(data["champion_user"].id)},
            headers=headers,
        )
        await execute_patch_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/1/node/10/complete",
            payload={},
            headers=headers,
        )

        response = await execute_patch_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/1/node/10/ko",
            payload={"ko_count": 2},
            headers=headers,
        )
        assert response.status_code == 409


class TestWarFightFlags:
    """PATCH fight-not-done and planning-error flags — officers only."""

    @pytest.mark.asyncio
    async def test_toggle_fight_not_done_officer_ok(self):
        data = await _setup_attacker_scenario()
        headers_member = create_auth_headers(user_id=str(USER2_ID))
        headers_officer = create_auth_headers(user_id=str(USER_ID))

        await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/1/node/10/attacker",
            payload={"champion_user_id": str(data["champion_user"].id)},
            headers=headers_member,
        )

        resp = await execute_patch_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/1/node/10/fight-not-done",
            payload={},
            headers=headers_officer,
        )
        assert resp.status_code == 200
        assert resp.json()["is_fight_not_done"] is True

    @pytest.mark.asyncio
    async def test_toggle_fight_not_done_requires_officer(self):
        data = await _setup_attacker_scenario()
        headers_member = create_auth_headers(user_id=str(USER2_ID))

        await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/1/node/10/attacker",
            payload={"champion_user_id": str(data["champion_user"].id)},
            headers=headers_member,
        )

        resp = await execute_patch_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/1/node/10/fight-not-done",
            payload={},
            headers=headers_member,
        )
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_toggle_fight_not_done_no_attacker_returns_422(self):
        data = await _setup_attacker_scenario()
        headers_officer = create_auth_headers(user_id=str(USER_ID))

        resp = await execute_patch_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/1/node/10/fight-not-done",
            payload={},
            headers=headers_officer,
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_toggle_fight_not_done_blocked_when_combat_completed(self):
        data = await _setup_attacker_scenario()
        headers_member = create_auth_headers(user_id=str(USER2_ID))
        headers_officer = create_auth_headers(user_id=str(USER_ID))

        await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/1/node/10/attacker",
            payload={"champion_user_id": str(data["champion_user"].id)},
            headers=headers_member,
        )
        await execute_patch_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/1/node/10/complete",
            payload={},
            headers=headers_member,
        )

        resp = await execute_patch_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/1/node/10/fight-not-done",
            payload={},
            headers=headers_officer,
        )
        assert resp.status_code == 409

    @pytest.mark.asyncio
    async def test_toggle_fight_not_done_blocked_when_planning_error_set(self):
        data = await _setup_attacker_scenario()
        headers_member = create_auth_headers(user_id=str(USER2_ID))
        headers_officer = create_auth_headers(user_id=str(USER_ID))

        await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/1/node/10/attacker",
            payload={"champion_user_id": str(data["champion_user"].id)},
            headers=headers_member,
        )
        await execute_patch_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/1/node/10/planning-error",
            payload={},
            headers=headers_officer,
        )

        resp = await execute_patch_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/1/node/10/fight-not-done",
            payload={},
            headers=headers_officer,
        )
        assert resp.status_code == 409

    @pytest.mark.asyncio
    async def test_toggle_fight_not_done_is_idempotent(self):
        data = await _setup_attacker_scenario()
        headers_member = create_auth_headers(user_id=str(USER2_ID))
        headers_officer = create_auth_headers(user_id=str(USER_ID))

        await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/1/node/10/attacker",
            payload={"champion_user_id": str(data["champion_user"].id)},
            headers=headers_member,
        )
        await execute_patch_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/1/node/10/fight-not-done",
            payload={},
            headers=headers_officer,
        )

        resp = await execute_patch_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/1/node/10/fight-not-done",
            payload={},
            headers=headers_officer,
        )
        assert resp.status_code == 200
        assert resp.json()["is_fight_not_done"] is False

    @pytest.mark.asyncio
    async def test_toggle_planning_error_officer_ok(self):
        data = await _setup_attacker_scenario()
        headers_officer = create_auth_headers(user_id=str(USER_ID))

        resp = await execute_patch_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/1/node/10/planning-error",
            payload={},
            headers=headers_officer,
        )
        assert resp.status_code == 200
        assert resp.json()["is_planning_error"] is True

    @pytest.mark.asyncio
    async def test_toggle_planning_error_requires_officer(self):
        data = await _setup_attacker_scenario()
        headers_member = create_auth_headers(user_id=str(USER2_ID))

        resp = await execute_patch_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/1/node/10/planning-error",
            payload={},
            headers=headers_member,
        )
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_toggle_planning_error_blocked_when_fight_not_done_set(self):
        data = await _setup_attacker_scenario()
        headers_member = create_auth_headers(user_id=str(USER2_ID))
        headers_officer = create_auth_headers(user_id=str(USER_ID))

        await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/1/node/10/attacker",
            payload={"champion_user_id": str(data["champion_user"].id)},
            headers=headers_member,
        )
        await execute_patch_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/1/node/10/fight-not-done",
            payload={},
            headers=headers_officer,
        )

        resp = await execute_patch_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/1/node/10/planning-error",
            payload={},
            headers=headers_officer,
        )
        assert resp.status_code == 409

    @pytest.mark.asyncio
    async def test_toggle_planning_error_is_idempotent(self):
        data = await _setup_attacker_scenario()
        headers_officer = create_auth_headers(user_id=str(USER_ID))

        await execute_patch_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/1/node/10/planning-error",
            payload={},
            headers=headers_officer,
        )
        resp = await execute_patch_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/1/node/10/planning-error",
            payload={},
            headers=headers_officer,
        )
        assert resp.status_code == 200
        assert resp.json()["is_planning_error"] is False

    @pytest.mark.asyncio
    async def test_toggle_fight_not_done_missing_placement_returns_404(self):
        data = await _setup_attacker_scenario()
        headers_owner = create_auth_headers(user_id=str(USER_ID))
        resp = await execute_patch_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/1/node/99/fight-not-done",
            payload={},
            headers=headers_owner,
        )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_toggle_planning_error_missing_placement_returns_404(self):
        data = await _setup_attacker_scenario()
        headers_owner = create_auth_headers(user_id=str(USER_ID))
        resp = await execute_patch_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/1/node/99/planning-error",
            payload={},
            headers=headers_owner,
        )
        assert resp.status_code == 404

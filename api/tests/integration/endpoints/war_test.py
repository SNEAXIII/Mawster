"""Integration tests for war endpoints."""

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
    get_game_account,
)
from tests.integration.endpoints.setup.user_setup import get_generic_user, push_user2
from tests.utils.utils_db import load_objects
from src.models import User
from src.models.War import War
from src.models.DefensePlacement import DefensePlacement
from src.models.Season import Season
from src.enums.Roles import Roles

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


# ─── TestCreateWar ────────────────────────────────────────


class TestCreateWar:
    @pytest.mark.asyncio
    async def test_create_war_officer_success(self):
        data = await _setup_alliance()
        headers = create_auth_headers(user_id=str(USER_ID))

        response = await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars",
            payload={"opponent_name": "New Enemy"},
            headers=headers,
        )
        assert response.status_code == 201
        body = response.json()
        assert body["opponent_name"] == "New Enemy"
        assert body["alliance_id"] == str(data["alliance"].id)
        assert "created_by_pseudo" in body

    @pytest.mark.asyncio
    async def test_create_war_non_officer_forbidden(self):
        data = await _setup_alliance()
        # member (USER2_ID) is not an officer
        headers = create_auth_headers(user_id=str(USER2_ID))

        response = await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars",
            payload={"opponent_name": "New Enemy"},
            headers=headers,
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_create_war_conflict_when_active_war_exists(self):
        """Cannot declare a second war while one is already active."""
        data = await _setup_war()  # already has an active war
        headers = create_auth_headers(user_id=str(USER_ID))

        response = await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars",
            payload={"opponent_name": "Second Enemy"},
            headers=headers,
        )
        assert response.status_code == 409

    @pytest.mark.asyncio
    async def test_create_war_allowed_after_previous_ended(self):
        """Can declare a new war once the previous one is ended."""
        data = await _setup_war()
        headers = create_auth_headers(user_id=str(USER_ID))

        # End the existing war
        await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/end",
            payload={"win": True},
            headers=headers,
        )

        # Now declaring a new war should succeed
        response = await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars",
            payload={"opponent_name": "New Enemy"},
            headers=headers,
        )
        assert response.status_code == 201
        assert response.json()["status"] == "active"

    @pytest.mark.asyncio
    async def test_create_war_unauthenticated(self):
        data = await _setup_alliance()

        response = await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars",
            payload={"opponent_name": "New Enemy"},
        )
        assert response.status_code == 401


# ─── TestListWars ─────────────────────────────────────────


class TestListWars:
    @pytest.mark.asyncio
    async def test_list_wars_member_success(self):
        data = await _setup_war()
        headers = create_auth_headers(user_id=str(USER2_ID))

        response = await execute_get_request(
            f"/alliances/{data['alliance'].id}/wars",
            headers=headers,
        )
        assert response.status_code == 200
        body = response.json()
        assert isinstance(body, list)
        assert len(body) >= 1
        assert body[0]["opponent_name"] == OPPONENT

    @pytest.mark.asyncio
    async def test_list_wars_non_member_forbidden(self):
        data = await _setup_war()
        # Create a real user with a game account NOT in this alliance
        user3 = User(
            id=USER3_ID,
            login="user3",
            email="user3@test.com",
            role=Roles.USER,
            discord_id="discord_user3",
        )
        acc3 = get_game_account(user_id=USER3_ID, game_pseudo="OutsidePlayer")
        await load_objects([user3, acc3])

        other_headers = create_auth_headers(user_id=str(USER3_ID))
        response = await execute_get_request(
            f"/alliances/{data['alliance'].id}/wars",
            headers=other_headers,
        )
        assert response.status_code == 403


# ─── TestPlaceWarDefender ─────────────────────────────────


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


class TestCreateWarStatus:
    @pytest.mark.asyncio
    async def test_new_war_has_active_status(self):
        data = await _setup_alliance()
        headers = create_auth_headers(user_id=str(USER_ID))

        response = await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars",
            payload={"opponent_name": "Fresh Enemy"},
            headers=headers,
        )
        assert response.status_code == 201
        assert response.json()["status"] == "active"

    @pytest.mark.asyncio
    async def test_list_wars_includes_status_field(self):
        data = await _setup_war()
        headers = create_auth_headers(user_id=str(USER_ID))

        response = await execute_get_request(
            f"/alliances/{data['alliance'].id}/wars",
            headers=headers,
        )
        assert response.status_code == 200
        body = response.json()
        assert len(body) >= 1
        assert "status" in body[0]
        assert body[0]["status"] == "active"


# ─── TestEndWar ───────────────────────────────────────────


class TestEndWar:
    @pytest.mark.asyncio
    async def test_end_war_officer_success(self):
        data = await _setup_war()
        headers = create_auth_headers(user_id=str(USER_ID))

        response = await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/end",
            payload={"win": True},
            headers=headers,
        )
        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "ended"
        assert body["id"] == str(data["war"].id)

    @pytest.mark.asyncio
    async def test_end_war_non_officer_forbidden(self):
        data = await _setup_war()
        # USER2_ID is a member, not an officer
        headers = create_auth_headers(user_id=str(USER2_ID))

        response = await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/end",
            payload={"win": True},
            headers=headers,
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_end_war_unauthenticated(self):
        data = await _setup_war()

        response = await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/end",
            payload={"win": True},
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_end_war_wrong_alliance_not_found(self):
        data = await _setup_war()
        headers = create_auth_headers(user_id=str(USER_ID))
        wrong_alliance_id = uuid.uuid4()

        response = await execute_post_request(
            f"/alliances/{wrong_alliance_id}/wars/{data['war'].id}/end",
            payload={"win": True},
            headers=headers,
        )
        assert response.status_code in (403, 404)

    @pytest.mark.asyncio
    async def test_end_war_preserves_placements(self):
        """Ending a war must NOT delete its placements (history)."""
        data = await _setup_war()
        headers = create_auth_headers(user_id=str(USER_ID))

        # Place a defender
        await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/1/place",
            payload={
                "node_number": 5,
                "champion_id": str(data["champ"].id),
                "stars": 7,
                "rank": 3,
                "ascension": 0,
            },
            headers=headers,
        )

        # End the war
        end_response = await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/end",
            payload={"win": True},
            headers=headers,
        )
        assert end_response.status_code == 200
        assert end_response.json()["status"] == "ended"

        # War still appears in the list with its placements accessible
        list_response = await execute_get_request(
            f"/alliances/{data['alliance'].id}/wars",
            headers=headers,
        )
        wars = list_response.json()
        ended = next((w for w in wars if w["id"] == str(data["war"].id)), None)
        assert ended is not None
        assert ended["status"] == "ended"
        assert ended["opponent_name"] == OPPONENT

        # Placements are still readable
        defense_response = await execute_get_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/1",
            headers=headers,
        )
        assert defense_response.status_code == 200
        assert len(defense_response.json()["placements"]) == 1

    @pytest.mark.asyncio
    async def test_end_war_idempotent(self):
        """Ending an already-ended war returns 200 and keeps status 'ended'."""
        data = await _setup_war()
        headers = create_auth_headers(user_id=str(USER_ID))
        url = f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/end"

        await execute_post_request(url, payload={"win": True}, headers=headers)
        response = await execute_post_request(url, payload={"win": True}, headers=headers)

        assert response.status_code == 200
        assert response.json()["status"] == "ended"

    @pytest.mark.asyncio
    async def test_end_war_captures_win_and_tier_no_season(self):
        data = await _setup_war()
        headers = create_auth_headers(user_id=str(USER_ID))

        response = await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/end",
            payload={"win": True},
            headers=headers,
        )
        assert response.status_code == 200
        body = response.json()
        assert body["win"] is True
        assert body["elo_change"] is None
        assert body["tier"] == 20  # default

    @pytest.mark.asyncio
    async def test_end_war_during_season_applies_elo_gain(self):
        data = await _setup_alliance()
        season = Season(number=64, is_active=True)
        await load_objects([season])
        headers = create_auth_headers(user_id=str(USER_ID))

        declare = await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars",
            payload={"opponent_name": "Season Foe", "banned_champion_ids": []},
            headers=headers,
        )
        assert declare.status_code == 201
        war_id = declare.json()["id"]

        end = await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars/{war_id}/end",
            payload={"win": True, "elo_change": 50},
            headers=headers,
        )
        assert end.status_code == 200
        assert end.json()["elo_change"] == 50

        alliances = (await execute_get_request("/alliances/mine", headers=headers)).json()
        updated = next(a for a in alliances if a["id"] == str(data["alliance"].id))
        assert updated["elo"] == 50

    @pytest.mark.asyncio
    async def test_end_war_during_season_win_negative_elo_rejected(self):
        data = await _setup_alliance()
        season = Season(number=65, is_active=True)
        await load_objects([season])
        headers = create_auth_headers(user_id=str(USER_ID))

        declare = await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars",
            payload={"opponent_name": "S Foe2", "banned_champion_ids": []},
            headers=headers,
        )
        war_id = declare.json()["id"]

        end = await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars/{war_id}/end",
            payload={"win": True, "elo_change": -30},
            headers=headers,
        )
        assert end.status_code == 422

    @pytest.mark.asyncio
    async def test_end_war_during_season_missing_elo_change_rejected(self):
        data = await _setup_alliance()
        season = Season(number=66, is_active=True)
        await load_objects([season])
        headers = create_auth_headers(user_id=str(USER_ID))

        declare = await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars",
            payload={"opponent_name": "S Foe3", "banned_champion_ids": []},
            headers=headers,
        )
        war_id = declare.json()["id"]

        end = await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars/{war_id}/end",
            payload={"win": False},
            headers=headers,
        )
        assert end.status_code == 422


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

    # Assign owner and member to BG1 via API
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

    # Declare war
    war = War(
        id=uuid.uuid4(),
        alliance_id=alliance.id,
        opponent_name=OPPONENT,
        created_by_id=owner.id,
    )
    await load_objects([war])

    # Place defender on node 10
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

    # Add champion to member's roster
    champ2 = await push_champion(name="Wolverine", champion_class="Mutant")
    cu = await push_champion_user(member, champ2, stars=7, rank=3)

    return {
        **data,
        "war": war,
        "champ2": champ2,
        "champion_user": cu,
    }


# ─── TestAvailableAttackers ───────────────────────────────


class TestAvailableAttackers:
    @pytest.mark.asyncio
    async def test_available_attackers_member_can_view(self):
        data = await _setup_attacker_scenario()
        headers = create_auth_headers(user_id=str(USER2_ID))

        response = await execute_get_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/1/available-attackers",
            headers=headers,
        )
        assert response.status_code == 200
        body = response.json()
        assert isinstance(body, list)
        # Wolverine is in member's roster and not a defender
        names = [a["champion_name"] for a in body]
        assert "Wolverine" in names
        # Spider-Man is a defender → must be excluded
        assert "Spider-Man" not in names

    @pytest.mark.asyncio
    async def test_available_attackers_non_member_forbidden(self):
        data = await _setup_attacker_scenario()
        user3 = User(
            id=USER3_ID,
            login="user3",
            email="user3@test.com",
            role=Roles.USER,
            discord_id="discord_user3_atk",
        )
        acc3 = get_game_account(user_id=USER3_ID, game_pseudo="OutsiderAtk")
        await load_objects([user3, acc3])

        response = await execute_get_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/1/available-attackers",
            headers=create_auth_headers(user_id=str(USER3_ID)),
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_available_attackers_for_user_returns_own_champions_only(self):
        """GET available-attackers/{attacker_id} returns only that attacker's champions."""
        data = await _setup_attacker_scenario()
        # Give owner a champion so there are 2 accounts with champions in BG1
        extra_champ = await push_champion(name="Iron Man", champion_class="Tech")
        await push_champion_user(data["owner"], extra_champ, stars=6, rank=3)

        headers = create_auth_headers(user_id=str(USER2_ID))
        response = await execute_get_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/1/available-attackers?attacker_id={data['member'].id}",
            headers=headers,
        )
        assert response.status_code == 200
        body = response.json()
        assert isinstance(body, list)
        names = [a["champion_name"] for a in body]
        assert "Wolverine" in names
        assert "Iron Man" not in names  # owner's champion must not appear

    @pytest.mark.asyncio
    async def test_available_attackers_for_user_non_member_forbidden(self):
        """GET available-attackers/{attacker_id} returns 403 for non-members."""
        data = await _setup_attacker_scenario()
        user3 = User(
            id=USER3_ID,
            login="user3b",
            email="user3b@test.com",
            role=Roles.USER,
            discord_id="discord_user3_atk_filtered",
        )
        acc3 = get_game_account(user_id=USER3_ID, game_pseudo="OutsiderAtkF")
        await load_objects([user3, acc3])

        response = await execute_get_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/1/available-attackers?attacker_id={data['member'].id}",
            headers=create_auth_headers(user_id=str(USER3_ID)),
        )
        assert response.status_code == 403


# ─── TestAssignAttacker ───────────────────────────────────


class TestAssignAttacker:
    @pytest.mark.asyncio
    async def test_assign_attacker_success(self):
        data = await _setup_attacker_scenario()
        headers = create_auth_headers(user_id=str(USER2_ID))

        response = await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/1/node/10/attacker",
            payload={"champion_user_id": str(data["champion_user"].id)},
            headers=headers,
        )
        assert response.status_code == 200
        body = response.json()
        assert body["attacker_champion_name"] == "Wolverine"
        assert body["node_number"] == 10

    @pytest.mark.asyncio
    async def test_assign_attacker_node_without_defender_rejected(self):
        data = await _setup_attacker_scenario()
        headers = create_auth_headers(user_id=str(USER2_ID))

        response = await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/1/node/20/attacker",
            payload={"champion_user_id": str(data["champion_user"].id)},
            headers=headers,
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_assign_attacker_limit_3_per_member(self):
        """A member cannot have more than 3 attackers in the same BG."""
        data = await _setup_attacker_scenario()
        alliance = data["alliance"]
        war = data["war"]
        member = data["member"]
        headers_officer = create_auth_headers(user_id=str(USER_ID))
        headers_member = create_auth_headers(user_id=str(USER2_ID))

        # Place 4 defenders on nodes 11, 12, 13, 14 (different champions from attackers)
        for i, (name, cls) in enumerate(
            [
                ("Thor", "Cosmic"),
                ("Iron Man", "Tech"),
                ("Hulk", "Science"),
                ("Black Widow", "Skill"),
            ]
        ):
            c = await push_champion(name=name, champion_class=cls)
            await execute_post_request(
                f"/alliances/{alliance.id}/wars/{war.id}/bg/1/place",
                payload={
                    "node_number": 11 + i,
                    "champion_id": str(c.id),
                    "stars": 7,
                    "rank": 3,
                    "ascension": 0,
                },
                headers=headers_officer,
            )

        # Add DIFFERENT champions to member's roster and assign 3 attackers
        for i, (name, cls) in enumerate(
            [
                ("Black Panther", "Cosmic"),
                ("Captain Marvel", "Cosmic"),
                ("Doctor Strange", "Mystic"),
            ]
        ):
            ac = await push_champion(name=name, champion_class=cls)
            cu = await push_champion_user(member, ac, stars=7, rank=3)
            resp = await execute_post_request(
                f"/alliances/{alliance.id}/wars/{war.id}/bg/1/node/{11 + i}/attacker",
                payload={"champion_user_id": str(cu.id)},
                headers=headers_member,
            )
            assert resp.status_code == 200

        # Now try a 4th (also a different champion) → should fail with 3-attacker limit
        extra_champ = await push_champion(name="Vision", champion_class="Tech")
        extra_cu = await push_champion_user(member, extra_champ, stars=7, rank=3)
        response = await execute_post_request(
            f"/alliances/{alliance.id}/wars/{war.id}/bg/1/node/14/attacker",
            payload={"champion_user_id": str(extra_cu.id)},
            headers=headers_member,
        )
        assert response.status_code == 409

    @pytest.mark.asyncio
    async def test_assign_attacker_regular_defense_conflict(self):
        """Champion already in regular alliance defense cannot be assigned as war attacker."""
        data = await _setup_attacker_scenario()
        # Place Wolverine (data["champion_user"]) in regular defense for BG1
        defense = DefensePlacement(
            alliance_id=data["alliance"].id,
            battlegroup=1,
            node_number=5,
            champion_user_id=data["champion_user"].id,
            game_account_id=data["member"].id,
        )
        await load_objects([defense])

        headers = create_auth_headers(user_id=str(USER2_ID))
        response = await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/1/node/10/attacker",
            payload={"champion_user_id": str(data["champion_user"].id)},
            headers=headers,
        )
        assert response.status_code == 409

    @pytest.mark.asyncio
    async def test_available_attackers_excludes_regular_defense_champions(self):
        """Champion in regular alliance defense must not appear in available attackers."""
        data = await _setup_attacker_scenario()
        # Place Wolverine in regular defense
        defense = DefensePlacement(
            alliance_id=data["alliance"].id,
            battlegroup=1,
            node_number=5,
            champion_user_id=data["champion_user"].id,
            game_account_id=data["member"].id,
        )
        await load_objects([defense])

        headers = create_auth_headers(user_id=str(USER2_ID))
        response = await execute_get_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/1/available-attackers",
            headers=headers,
        )
        assert response.status_code == 200
        names = [a["champion_name"] for a in response.json()]
        assert "Wolverine" not in names

    @pytest.mark.asyncio
    async def test_available_attackers_excludes_defense_by_current_alliance_group(self):
        """Defense filter uses member's current alliance_group, not stored battlegroup."""
        data = await _setup_attacker_scenario()
        # Simulate inconsistency: defense stored as battlegroup=2 but member is in BG1
        # (can happen if member was moved after defense was created)
        defense = DefensePlacement(
            alliance_id=data["alliance"].id,
            battlegroup=2,  # stored with wrong BG
            node_number=5,
            champion_user_id=data["champion_user"].id,
            game_account_id=data["member"].id,
        )
        await load_objects([defense])

        headers = create_auth_headers(user_id=str(USER2_ID))
        response = await execute_get_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/1/available-attackers",
            headers=headers,
        )
        assert response.status_code == 200
        names = [a["champion_name"] for a in response.json()]
        # Member is in BG1; their champion is in defense (stored as BG2 due to inconsistency).
        # Robust fix: filter by member's current alliance_group, so still excluded.
        assert "Wolverine" not in names

    @pytest.mark.asyncio
    async def test_reassign_attacker_on_occupied_node_does_not_count_as_extra(self):
        """Replacing the attacker on a node already assigned to this member must not
        trigger the 3-attacker limit — the old assignment is being replaced, not added."""
        data = await _setup_attacker_scenario()
        alliance = data["alliance"]
        war = data["war"]
        member = data["member"]
        headers_officer = create_auth_headers(user_id=str(USER_ID))
        headers_member = create_auth_headers(user_id=str(USER2_ID))

        # Place 3 defenders on nodes 11, 12, 13
        defender_champs = [("Thor", "Cosmic"), ("Iron Man", "Tech"), ("Hulk", "Science")]
        for i, (name, cls) in enumerate(defender_champs):
            c = await push_champion(name=name, champion_class=cls)
            await execute_post_request(
                f"/alliances/{alliance.id}/wars/{war.id}/bg/1/place",
                payload={
                    "node_number": 11 + i,
                    "champion_id": str(c.id),
                    "stars": 7,
                    "rank": 3,
                    "ascension": 0,
                },
                headers=headers_officer,
            )

        # Assign 3 different champions from member's roster to nodes 11, 12, 13
        attacker_champs_cu = []
        for i, (name, cls) in enumerate(
            [
                ("Black Panther", "Cosmic"),
                ("Captain Marvel", "Cosmic"),
                ("Doctor Strange", "Mystic"),
            ]
        ):
            ac = await push_champion(name=name, champion_class=cls)
            cu = await push_champion_user(member, ac, stars=7, rank=3)
            attacker_champs_cu.append(cu)
            resp = await execute_post_request(
                f"/alliances/{alliance.id}/wars/{war.id}/bg/1/node/{11 + i}/attacker",
                payload={"champion_user_id": str(cu.id)},
                headers=headers_member,
            )
            assert resp.status_code == 200

        # Replace the attacker on node 11 with a new champion — member still has 3 total
        # This must NOT be rejected by the limit check (was a bug: counted as 4th attacker)
        replacement_champ = await push_champion(name="Vision", champion_class="Tech")
        replacement_cu = await push_champion_user(member, replacement_champ, stars=7, rank=3)
        response = await execute_post_request(
            f"/alliances/{alliance.id}/wars/{war.id}/bg/1/node/11/attacker",
            payload={"champion_user_id": str(replacement_cu.id)},
            headers=headers_member,
        )
        assert response.status_code == 200
        assert response.json()["attacker_champion_name"] == "Vision"

    @pytest.mark.asyncio
    async def test_assign_attacker_non_member_forbidden(self):
        data = await _setup_attacker_scenario()
        user3 = User(
            id=USER3_ID,
            login="user3-atk2",
            email="user3atk2@test.com",
            role=Roles.USER,
            discord_id="discord_user3_atk2",
        )
        await load_objects([user3])

        response = await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/1/node/10/attacker",
            payload={"champion_user_id": str(data["champion_user"].id)},
            headers=create_auth_headers(user_id=str(USER3_ID)),
        )
        assert response.status_code == 403


# ─── TestRemoveAttacker ───────────────────────────────────


class TestRemoveAttacker:
    @pytest.mark.asyncio
    async def test_remove_attacker_success(self):
        data = await _setup_attacker_scenario()
        headers = create_auth_headers(user_id=str(USER2_ID))

        # Assign attacker
        await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/1/node/10/attacker",
            payload={"champion_user_id": str(data["champion_user"].id)},
            headers=headers,
        )
        # Set some KOs
        await execute_patch_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/1/node/10/ko",
            payload={"ko_count": 2},
            headers=headers,
        )
        # Remove attacker — should also reset KOs
        response = await execute_delete_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/1/node/10/attacker",
            headers=headers,
        )
        assert response.status_code == 200
        assert response.json()["attacker_champion_user_id"] is None
        assert response.json()["ko_count"] == 0

    @pytest.mark.asyncio
    async def test_remove_attacker_not_assigned_returns_404(self):
        data = await _setup_attacker_scenario()
        headers = create_auth_headers(user_id=str(USER_ID))

        response = await execute_delete_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/1/node/10/attacker",
            headers=headers,
        )
        assert response.status_code == 404


# ─── TestUpdateKo ─────────────────────────────────────────


class TestUpdateKo:
    @pytest.mark.asyncio
    async def test_update_ko_success_by_member(self):
        """Non-officer member can update KO count when an attacker is assigned."""
        data = await _setup_attacker_scenario()
        headers = create_auth_headers(user_id=str(USER2_ID))

        await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/1/node/10/attacker",
            payload={"champion_user_id": str(data["champion_user"].id)},
            headers=headers,
        )

        response = await execute_patch_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/1/node/10/ko",
            payload={"ko_count": 3},
            headers=headers,
        )
        assert response.status_code == 200
        assert response.json()["ko_count"] == 3

    @pytest.mark.asyncio
    async def test_update_ko_without_attacker_returns_400(self):
        """KO update is rejected when no attacker is assigned to the node."""
        data = await _setup_attacker_scenario()
        headers = create_auth_headers(user_id=str(USER2_ID))

        response = await execute_patch_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/1/node/10/ko",
            payload={"ko_count": 2},
            headers=headers,
        )
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_update_ko_negative_rejected(self):
        data = await _setup_attacker_scenario()
        headers = create_auth_headers(user_id=str(USER_ID))

        response = await execute_patch_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/1/node/10/ko",
            payload={"ko_count": -1},
            headers=headers,
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_update_ko_node_not_found(self):
        data = await _setup_attacker_scenario()
        headers = create_auth_headers(user_id=str(USER_ID))

        response = await execute_patch_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/1/node/55/ko",
            payload={"ko_count": 2},
            headers=headers,
        )
        assert response.status_code == 404


# ─── TestGetCurrentWar ────────────────────────────────────


class TestGetCurrentWar:
    """GET /alliances/{alliance_id}/wars/current"""

    @pytest.mark.asyncio
    async def test_returns_active_war(self):
        data = await _setup_war()
        alliance = data["alliance"]
        war = data["war"]
        headers = create_auth_headers(user_id=str(USER_ID))

        response = await execute_get_request(
            f"/alliances/{alliance.id}/wars/current",
            headers=headers,
        )
        assert response.status_code == 200
        body = response.json()
        assert body["id"] == str(war.id)
        assert body["status"] == "active"
        assert body["opponent_name"] == OPPONENT

    @pytest.mark.asyncio
    async def test_returns_404_when_no_active_war(self):
        data = await _setup_alliance()
        alliance = data["alliance"]
        headers = create_auth_headers(user_id=str(USER_ID))

        response = await execute_get_request(
            f"/alliances/{alliance.id}/wars/current",
            headers=headers,
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_returns_404_after_war_ended(self):
        data = await _setup_war()
        alliance = data["alliance"]
        war = data["war"]
        headers = create_auth_headers(user_id=str(USER_ID))

        # End the war first
        await execute_post_request(
            f"/alliances/{alliance.id}/wars/{war.id}/end",
            payload={"win": True},
            headers=headers,
        )

        response = await execute_get_request(
            f"/alliances/{alliance.id}/wars/current",
            headers=headers,
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_returns_403_for_non_member(self):
        data = await _setup_war()
        alliance = data["alliance"]
        # Load a user + game account that is NOT a member of this alliance
        user3 = User(
            id=USER3_ID,
            login="user3",
            email="user3@test.com",
            role=Roles.USER,
            discord_id="discord_user3",
        )
        acc3 = get_game_account(user_id=USER3_ID, game_pseudo="OutsidePlayer")
        await load_objects([user3, acc3])

        headers = create_auth_headers(user_id=str(USER3_ID))
        response = await execute_get_request(
            f"/alliances/{alliance.id}/wars/current",
            headers=headers,
        )
        assert response.status_code == 403


# ─── TestWarBans ──────────────────────────────────────────


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


class TestWarSeasonLink:
    @pytest.mark.asyncio
    async def test_war_created_with_active_season(self):
        """War created while a season is active gets that season_id."""
        data = await _setup_alliance()
        season = Season(number=64, is_active=True)
        await load_objects([season])

        headers = create_auth_headers(user_id=str(USER_ID), role=Roles.USER)
        response = await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars",
            {"opponent_name": OPPONENT, "banned_champion_ids": []},
            headers,
        )
        assert response.status_code == 201
        body = response.json()
        assert body["season_id"] == str(season.id)
        assert body["season_number"] == 64

    @pytest.mark.asyncio
    async def test_war_created_without_active_season_is_off_season(self):
        """War created when no season is active has season_id=null."""
        data = await _setup_alliance()

        headers = create_auth_headers(user_id=str(USER_ID), role=Roles.USER)
        response = await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars",
            {"opponent_name": OPPONENT, "banned_champion_ids": []},
            headers,
        )
        assert response.status_code == 201
        body = response.json()
        assert body["season_id"] is None
        assert body["season_number"] is None

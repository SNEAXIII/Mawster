"""Integration tests for war core endpoints."""

import uuid

import pytest

from tests.utils.utils_client import (
    create_auth_headers,
    execute_get_request,
    execute_post_request,
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
from src.models.Champion import Champion
from src.models.War import War
from src.models.Season import Season
from src.enums.SeasonStatus import SeasonStatus
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
    async def test_create_war_rejects_more_than_seven_bans(self):
        data = await _setup_alliance()
        headers = create_auth_headers(user_id=str(USER_ID))

        extra_champs = [
            Champion(name=f"Ban Champ {idx}", champion_class="Science") for idx in range(8)
        ]
        await load_objects(extra_champs)

        response = await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars",
            payload={
                "opponent_name": "New Enemy",
                "banned_champion_ids": [str(champ.id) for champ in extra_champs],
            },
            headers=headers,
        )
        assert response.status_code == 422

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
        season = Season(number=64, status=SeasonStatus.active)
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
        season = Season(number=65, status=SeasonStatus.active)
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
        season = Season(number=66, status=SeasonStatus.active)
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

    @pytest.mark.asyncio
    async def test_end_war_loss_positive_elo_rejected(self):
        data = await _setup_alliance()
        headers = create_auth_headers(user_id=str(USER_ID))
        season = Season(number=67, status=SeasonStatus.active)
        await load_objects([season])
        declare = await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars",
            payload={"opponent_name": "Season Foe"},
            headers=headers,
        )
        assert declare.status_code == 201
        war_id = declare.json()["id"]
        resp = await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars/{war_id}/end",
            payload={"win": False, "elo_change": 50},
            headers=headers,
        )
        assert resp.status_code == 422


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

    @pytest.mark.asyncio
    async def test_get_war_unknown_war_id_returns_404(self):
        data = await _setup_war()
        headers = create_auth_headers(user_id=str(USER_ID))
        resp = await execute_get_request(
            f"/alliances/{data['alliance'].id}/wars/{uuid.uuid4()}/bg/1",
            headers=headers,
        )
        assert resp.status_code == 404


# ─── TestWarBans ──────────────────────────────────────────


class TestWarSeasonLink:
    @pytest.mark.asyncio
    async def test_war_created_with_active_season(self):
        """War created while a season is active gets that season_id."""
        data = await _setup_alliance()
        season = Season(number=64, status=SeasonStatus.active)
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


# ─── TestToggleCombatCompleted ────────────────────────────────────────────────

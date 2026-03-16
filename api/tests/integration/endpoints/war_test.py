"""Integration tests for war endpoints."""
import uuid

import pytest

from tests.utils.utils_client import (
    create_auth_headers,
    execute_get_request,
    execute_post_request,
    execute_delete_request,
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
    get_game_account,
)
from tests.integration.endpoints.setup.user_setup import get_generic_user, push_user2
from tests.utils.utils_db import load_objects
from src.models import User
from src.models.War import War
from src.enums.Roles import Roles

USER3_ID = uuid.UUID("00000000-0000-0000-0000-000000000003")

OPPONENT = "Enemy Alliance"


# ─── Helpers ──────────────────────────────────────────────

async def _setup_war(
    owner_user_id=USER_ID,
    member_user_id=USER2_ID,
):
    """Create alliance + owner (officer) + member + champion + one declared war."""
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

    war = War(
        id=uuid.uuid4(),
        alliance_id=alliance.id,
        opponent_name=OPPONENT,
        created_by_id=owner.id,
    )
    await load_objects([war])

    return {
        "alliance": alliance,
        "owner": owner,
        "member": member,
        "champ": champ,
        "war": war,
    }


# ─── TestCreateWar ────────────────────────────────────────

class TestCreateWar:
    @pytest.mark.asyncio
    async def test_create_war_officer_success(self):
        data = await _setup_war()
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
        data = await _setup_war()
        # member (USER2_ID) is not an officer
        headers = create_auth_headers(user_id=str(USER2_ID))

        response = await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars",
            payload={"opponent_name": "New Enemy"},
            headers=headers,
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_create_war_unauthenticated(self):
        data = await _setup_war()

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
    async def test_place_defender_duplicate_champion_conflict(self):
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
        # Same champion on a different node → 409
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
        assert response.status_code == 409

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

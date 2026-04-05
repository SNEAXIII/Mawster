"""Integration tests for war pre-fight endpoints."""
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
from src.models.DefensePlacement import DefensePlacement

OPPONENT = "Enemy Alliance"


def _prefight_url(alliance_id, war_id, battlegroup=1):
    return f"/alliances/{alliance_id}/wars/{war_id}/bg/{battlegroup}/prefight"


async def _setup_prefight_scenario():
    """
    Sets up:
    - owner (BG1) + member (BG1) in same alliance
    - a war
    - defender on node 5, attacker assigned to node 5 (member's champion)
    - prefight_cu: member's second champion (for pre-fight)
    """
    await load_objects([get_generic_user(is_base_id=True)])
    await push_user2()

    alliance, owner = await push_alliance_with_owner(
        user_id=USER_ID,
        game_pseudo=GAME_PSEUDO,
        alliance_name=ALLIANCE_NAME,
        alliance_tag=ALLIANCE_TAG,
    )
    await push_officer(alliance, owner)
    member = await push_member(alliance, user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)

    headers_owner = create_auth_headers(user_id=str(USER_ID))
    headers_member = create_auth_headers(user_id=str(USER2_ID))

    # Assign both to BG1
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

    # Place defender on node 5
    defender_champ = await push_champion(name="Iron Man", champion_class="Tech")
    await execute_post_request(
        f"/alliances/{alliance.id}/wars/{war.id}/bg/1/place",
        payload={"node_number": 5, "champion_id": str(defender_champ.id), "stars": 7, "rank": 3, "ascension": 0},
        headers=headers_owner,
    )

    # Assign node attacker (member's champion on node 5)
    attacker_champ = await push_champion(name="Wolverine", champion_class="Mutant")
    attacker_cu = await push_champion_user(member, attacker_champ, stars=7, rank=3)
    await execute_post_request(
        f"/alliances/{alliance.id}/wars/{war.id}/bg/1/node/5/attacker",
        payload={"champion_user_id": str(attacker_cu.id)},
        headers=headers_member,
    )

    # Member's second champion for pre-fight
    prefight_champ = await push_champion(name="Quake", champion_class="Science")
    prefight_cu = await push_champion_user(member, prefight_champ, stars=7, rank=3)

    return {
        "owner": owner,
        "member": member,
        "alliance": alliance,
        "war": war,
        "attacker_cu": attacker_cu,
        "prefight_cu": prefight_cu,
        "headers_member": headers_member,
        "headers_owner": headers_owner,
    }


class TestGetPrefight:
    @pytest.mark.asyncio
    async def test_get_prefight_empty(self):
        data = await _setup_prefight_scenario()
        response = await execute_get_request(
            _prefight_url(data["alliance"].id, data["war"].id),
            headers=data["headers_member"],
        )
        assert response.status_code == 200
        assert response.json() == []

    @pytest.mark.asyncio
    async def test_get_prefight_returns_added(self):
        data = await _setup_prefight_scenario()
        await execute_post_request(
            _prefight_url(data["alliance"].id, data["war"].id),
            payload={
                "champion_user_id": str(data["prefight_cu"].id),
                "target_node_number": 5,
            },
            headers=data["headers_member"],
        )
        response = await execute_get_request(
            _prefight_url(data["alliance"].id, data["war"].id),
            headers=data["headers_member"],
        )
        assert response.status_code == 200
        body = response.json()
        assert len(body) == 1
        assert body[0]["champion_name"] == "Quake"
        assert body[0]["target_node_number"] == 5


class TestAddPrefight:
    @pytest.mark.asyncio
    async def test_add_prefight_success(self):
        data = await _setup_prefight_scenario()
        response = await execute_post_request(
            _prefight_url(data["alliance"].id, data["war"].id),
            payload={
                "champion_user_id": str(data["prefight_cu"].id),
                "target_node_number": 5,
            },
            headers=data["headers_member"],
        )
        assert response.status_code == 201
        body = response.json()
        assert body["champion_name"] == "Quake"
        assert body["target_node_number"] == 5
        assert body["game_pseudo"] == GAME_PSEUDO_2

    @pytest.mark.asyncio
    async def test_add_prefight_target_node_no_defender_rejected(self):
        """Target node must have a defender placed."""
        data = await _setup_prefight_scenario()
        response = await execute_post_request(
            _prefight_url(data["alliance"].id, data["war"].id),
            payload={
                "champion_user_id": str(data["prefight_cu"].id),
                "target_node_number": 99,
            },
            headers=data["headers_member"],
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_add_prefight_target_node_no_attacker_rejected(self):
        """Target node must have an attacker assigned."""
        data = await _setup_prefight_scenario()
        extra_champ = await push_champion(name="Hulk", champion_class="Science")
        await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/1/place",
            payload={"node_number": 10, "champion_id": str(extra_champ.id), "stars": 7, "rank": 3, "ascension": 0},
            headers=data["headers_owner"],
        )
        response = await execute_post_request(
            _prefight_url(data["alliance"].id, data["war"].id),
            payload={
                "champion_user_id": str(data["prefight_cu"].id),
                "target_node_number": 10,
            },
            headers=data["headers_member"],
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_add_prefight_teammate_champion_allowed(self):
        """Any BG member can use any other BG member's champion as pre-fight provider."""
        data = await _setup_prefight_scenario()
        owner_champ = await push_champion(name="Thor", champion_class="Cosmic")
        owner_cu = await push_champion_user(data["owner"], owner_champ, stars=7, rank=3)
        response = await execute_post_request(
            _prefight_url(data["alliance"].id, data["war"].id),
            payload={
                "champion_user_id": str(owner_cu.id),
                "target_node_number": 5,
            },
            headers=data["headers_member"],
        )
        assert response.status_code == 201

    @pytest.mark.asyncio
    async def test_add_prefight_any_bg_member_can_target_any_node(self):
        """Owner can pre-fight a node where member is the attacker."""
        data = await _setup_prefight_scenario()
        owner_champ = await push_champion(name="Gamora", champion_class="Cosmic")
        owner_cu = await push_champion_user(data["owner"], owner_champ, stars=7, rank=3)
        response = await execute_post_request(
            _prefight_url(data["alliance"].id, data["war"].id),
            payload={
                "champion_user_id": str(owner_cu.id),
                "target_node_number": 5,
            },
            headers=data["headers_owner"],
        )
        assert response.status_code == 201

    @pytest.mark.asyncio
    async def test_add_prefight_defense_conflict_rejected(self):
        """Champion already in alliance defense cannot be pre-fight provider."""
        data = await _setup_prefight_scenario()
        defense_champ = await push_champion(name="Captain America", champion_class="Science")
        defense_cu = await push_champion_user(data["member"], defense_champ, stars=7, rank=3)
        await load_objects([
            DefensePlacement(
                alliance_id=data["alliance"].id,
                battlegroup=1,
                node_number=3,
                game_account_id=data["member"].id,
                champion_user_id=defense_cu.id,
            )
        ])
        response = await execute_post_request(
            _prefight_url(data["alliance"].id, data["war"].id),
            payload={
                "champion_user_id": str(defense_cu.id),
                "target_node_number": 5,
            },
            headers=data["headers_member"],
        )
        assert response.status_code == 409

    @pytest.mark.asyncio
    async def test_add_prefight_slot_limit_enforced(self):
        """Member cannot exceed 3 combined node+synergy+prefight slots."""
        data = await _setup_prefight_scenario()
        alliance = data["alliance"]
        war = data["war"]
        member = data["member"]
        headers_member = data["headers_member"]
        headers_owner = data["headers_owner"]

        # member already has 1 node attacker (attacker_cu on node 5)
        # add 2 more node attackers for member (total 3)
        for i, (name, cls) in enumerate([("Black Panther", "Cosmic"), ("Captain Marvel", "Cosmic")]):
            champ = await push_champion(name=name, champion_class=cls)
            cu = await push_champion_user(member, champ, stars=7, rank=3)
            await execute_post_request(
                f"/alliances/{alliance.id}/wars/{war.id}/bg/1/place",
                payload={"node_number": 6 + i, "champion_id": str(champ.id), "stars": 7, "rank": 3, "ascension": 0},
                headers=headers_owner,
            )
            await execute_post_request(
                f"/alliances/{alliance.id}/wars/{war.id}/bg/1/node/{6 + i}/attacker",
                payload={"champion_user_id": str(cu.id)},
                headers=headers_member,
            )

        # Now member has 3 node attackers → adding pre-fight must fail
        extra_champ = await push_champion(name="Black Widow", champion_class="Skill")
        extra_cu = await push_champion_user(member, extra_champ, stars=7, rank=3)
        response = await execute_post_request(
            _prefight_url(alliance.id, war.id),
            payload={"champion_user_id": str(extra_cu.id), "target_node_number": 5},
            headers=headers_member,
        )
        assert response.status_code == 409

    @pytest.mark.asyncio
    async def test_add_prefight_duplicate_rejected(self):
        """Same champion cannot be pre-fight provider twice."""
        data = await _setup_prefight_scenario()
        payload = {"champion_user_id": str(data["prefight_cu"].id), "target_node_number": 5}
        await execute_post_request(
            _prefight_url(data["alliance"].id, data["war"].id),
            payload=payload,
            headers=data["headers_member"],
        )
        response = await execute_post_request(
            _prefight_url(data["alliance"].id, data["war"].id),
            payload=payload,
            headers=data["headers_member"],
        )
        assert response.status_code == 409


class TestRemovePrefight:
    @pytest.mark.asyncio
    async def test_remove_prefight_success(self):
        data = await _setup_prefight_scenario()
        await execute_post_request(
            _prefight_url(data["alliance"].id, data["war"].id),
            payload={"champion_user_id": str(data["prefight_cu"].id), "target_node_number": 5},
            headers=data["headers_member"],
        )
        response = await execute_delete_request(
            _prefight_url(data["alliance"].id, data["war"].id) + f"/{data['prefight_cu'].id}",
            headers=data["headers_member"],
        )
        assert response.status_code == 204

    @pytest.mark.asyncio
    async def test_remove_prefight_not_found(self):
        data = await _setup_prefight_scenario()
        response = await execute_delete_request(
            _prefight_url(data["alliance"].id, data["war"].id) + f"/{uuid.uuid4()}",
            headers=data["headers_member"],
        )
        assert response.status_code == 404

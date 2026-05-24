"""Integration tests for war assist endpoints — covers WarService lines 932-994."""

import uuid

import pytest

from tests.utils.utils_client import (
    create_auth_headers,
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
from src.enums.Roles import Roles

USER3_ID = uuid.UUID("00000000-0000-0000-0000-000000000003")
OPPONENT = "Enemy Alliance"


def _assist_url(alliance_id, war_id, battlegroup=1, node_number=10):
    return f"/alliances/{alliance_id}/wars/{war_id}/bg/{battlegroup}/node/{node_number}/assist"


async def _setup_assist_scenario():
    """
    Setup:
    - owner (officer, BG1) + member (BG1) in same alliance
    - war declared
    - defender placed on node 10 (owner places)
    - attacker assigned on node 10 (member's champion)
    - USER3 in BG1 with their own champion (for assist, different game account)
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

    # USER3: second member with a different game account, force into alliance BG1
    user3 = User(
        id=USER3_ID,
        login="user3",
        email="user3@test.com",
        role=Roles.USER,
        discord_id="discord_user3_assist",
    )
    acc3 = get_game_account(user_id=USER3_ID, game_pseudo="Assistor")
    acc3.alliance_id = alliance.id
    acc3.alliance_group = 1
    await load_objects([user3, acc3])

    headers_owner = create_auth_headers(user_id=str(USER_ID))
    headers_member = create_auth_headers(user_id=str(USER2_ID))
    headers_user3 = create_auth_headers(user_id=str(USER3_ID))

    # Put owner + member in BG1
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

    # Place defender on node 10
    defender_champ = await push_champion(name="Spider-Man", champion_class="Science")
    await execute_post_request(
        f"/alliances/{alliance.id}/wars/{war.id}/bg/1/place",
        payload={
            "node_number": 10,
            "champion_id": str(defender_champ.id),
            "stars": 7,
            "rank": 3,
            "ascension": 0,
        },
        headers=headers_owner,
    )

    # Assign attacker: member's champion
    attacker_champ = await push_champion(name="Wolverine", champion_class="Mutant")
    attacker_cu = await push_champion_user(member, attacker_champ, stars=7, rank=3)
    await execute_post_request(
        f"/alliances/{alliance.id}/wars/{war.id}/bg/1/node/10/attacker",
        payload={"champion_user_id": str(attacker_cu.id)},
        headers=headers_member,
    )

    # Assistor: acc3's champion (different game account, same BG as BG1)
    assist_champ = await push_champion(name="Deadpool", champion_class="Mutant")
    assist_cu = await push_champion_user(acc3, assist_champ, stars=7, rank=3)

    return {
        "alliance": alliance,
        "owner": owner,
        "member": member,
        "user3": user3,
        "acc3": acc3,
        "war": war,
        "attacker_cu": attacker_cu,
        "assist_cu": assist_cu,
        "headers_owner": headers_owner,
        "headers_member": headers_member,
        "headers_user3": headers_user3,
    }


class TestAssignAssist:
    @pytest.mark.asyncio
    async def test_assign_assist_success(self):
        """USER3 (different game account, same BG) can assign assist on node 10 (L932-973)."""
        data = await _setup_assist_scenario()
        response = await execute_post_request(
            _assist_url(data["alliance"].id, data["war"].id),
            payload={"champion_user_id": str(data["assist_cu"].id)},
            headers=data["headers_user3"],
        )
        assert response.status_code == 200
        body = response.json()
        assert body["assistor_champion_user_id"] == str(data["assist_cu"].id)
        assert body["is_assisted"] is True

    @pytest.mark.asyncio
    async def test_assign_assist_no_defender_on_node_returns_404(self):
        """Node with no defender placed returns 404 (L933-934)."""
        data = await _setup_assist_scenario()
        response = await execute_post_request(
            _assist_url(data["alliance"].id, data["war"].id, node_number=99),
            payload={"champion_user_id": str(data["assist_cu"].id)},
            headers=data["headers_user3"],
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_assign_assist_no_attacker_assigned_returns_422(self):
        """Node has a defender but no attacker yet — assist rejected (L935-939)."""
        data = await _setup_assist_scenario()
        # Place a second defender on node 20 with no attacker assigned
        extra_champ = await push_champion(name="Thor", champion_class="Cosmic")
        await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/1/place",
            payload={
                "node_number": 20,
                "champion_id": str(extra_champ.id),
                "stars": 7,
                "rank": 3,
                "ascension": 0,
            },
            headers=data["headers_owner"],
        )
        response = await execute_post_request(
            _assist_url(data["alliance"].id, data["war"].id, node_number=20),
            payload={"champion_user_id": str(data["assist_cu"].id)},
            headers=data["headers_user3"],
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_assign_assist_unknown_champion_user_returns_404(self):
        """Non-existent champion_user_id returns 404 (L947-950)."""
        data = await _setup_assist_scenario()
        response = await execute_post_request(
            _assist_url(data["alliance"].id, data["war"].id),
            payload={"champion_user_id": str(uuid.uuid4())},
            headers=data["headers_user3"],
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_assign_assist_champion_not_in_alliance_bg_returns_403(self):
        """Assistor's game account must be in the same alliance+BG (L953-958)."""
        data = await _setup_assist_scenario()
        # Move acc3 to BG2 via the alliance members endpoint
        await execute_patch_request(
            f"/alliances/{data['alliance'].id}/members/{data['acc3'].id}/group",
            payload={"group": 2},
            headers=data["headers_owner"],
        )
        response = await execute_post_request(
            _assist_url(data["alliance"].id, data["war"].id, battlegroup=1),
            payload={"champion_user_id": str(data["assist_cu"].id)},
            headers=data["headers_user3"],
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_assign_assist_same_account_as_attacker_returns_409(self):
        """Assistor from same game account as the node attacker is rejected (L965-966)."""
        data = await _setup_assist_scenario()
        # Member assigns their OWN second champion as assist — same game account as the attacker
        second_champ = await push_champion(name="Captain America", champion_class="Science")
        second_cu = await push_champion_user(data["member"], second_champ, stars=7, rank=3)
        response = await execute_post_request(
            _assist_url(data["alliance"].id, data["war"].id),
            payload={"champion_user_id": str(second_cu.id)},
            headers=data["headers_member"],
        )
        assert response.status_code == 409


class TestRemoveAssist:
    @pytest.mark.asyncio
    async def test_remove_assist_success(self):
        """Removing an assigned assist clears it from the placement (L983-994)."""
        data = await _setup_assist_scenario()
        # Assign first
        await execute_post_request(
            _assist_url(data["alliance"].id, data["war"].id),
            payload={"champion_user_id": str(data["assist_cu"].id)},
            headers=data["headers_user3"],
        )
        response = await execute_delete_request(
            _assist_url(data["alliance"].id, data["war"].id),
            headers=data["headers_user3"],
        )
        assert response.status_code == 200
        body = response.json()
        assert body["assistor_champion_user_id"] is None
        assert body["is_assisted"] is False

    @pytest.mark.asyncio
    async def test_remove_assist_no_defender_returns_404(self):
        """Node without a defender returns 404 on remove (L984-985)."""
        data = await _setup_assist_scenario()
        response = await execute_delete_request(
            _assist_url(data["alliance"].id, data["war"].id, node_number=99),
            headers=data["headers_user3"],
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_remove_assist_none_assigned_returns_404(self):
        """Removing assist when none is assigned returns 404 (L986-987)."""
        data = await _setup_assist_scenario()
        # Node 10 has defender + attacker but no assist yet
        response = await execute_delete_request(
            _assist_url(data["alliance"].id, data["war"].id),
            headers=data["headers_member"],
        )
        assert response.status_code == 404

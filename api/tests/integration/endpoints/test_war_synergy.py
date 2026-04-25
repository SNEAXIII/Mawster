"""Integration tests for war synergy endpoints."""

import uuid

import pytest

from tests.utils.utils_client import (
    create_auth_headers,
    execute_get_request,
    execute_post_request,
    execute_patch_request,
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
    push_champion_user,
)
from tests.integration.endpoints.setup.user_setup import get_generic_user, push_user2
from tests.utils.utils_db import load_objects
from src.models.War import War
from src.models.DefensePlacement import DefensePlacement

OPPONENT = "Enemy Alliance"


# ─── Helpers ──────────────────────────────────────────────


async def _setup_synergy_scenario():
    """
    Create alliance + owner (officer, BG1) + member (BG1) + war +
    defender on node 10 + node attacker assigned.
    Returns dict with all objects needed for synergy tests.
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

    # Assign node attacker (member's champion on node 10)
    attacker_champ = await push_champion(name="Wolverine", champion_class="Mutant")
    attacker_cu = await push_champion_user(member, attacker_champ, stars=7, rank=3)
    await execute_post_request(
        f"/alliances/{alliance.id}/wars/{war.id}/bg/1/node/10/attacker",
        payload={"champion_user_id": str(attacker_cu.id)},
        headers=headers_member,
    )

    # Add a second champion to member's roster for synergy
    synergy_champ = await push_champion(name="Deadpool", champion_class="Mutant")
    synergy_cu = await push_champion_user(member, synergy_champ, stars=7, rank=3)

    return {
        "alliance": alliance,
        "war": war,
        "owner": owner,
        "member": member,
        "attacker_cu": attacker_cu,
        "synergy_cu": synergy_cu,
        "headers_owner": headers_owner,
        "headers_member": headers_member,
    }


def _synergy_url(alliance_id, war_id, bg=1):
    return f"/alliances/{alliance_id}/wars/{war_id}/bg/{bg}/synergy"


# ─── TestAddSynergy ───────────────────────────────────────


class TestAddSynergy:
    @pytest.mark.asyncio
    async def test_add_synergy_success(self):
        data = await _setup_synergy_scenario()
        response = await execute_post_request(
            _synergy_url(data["alliance"].id, data["war"].id),
            payload={
                "champion_user_id": str(data["synergy_cu"].id),
                "target_champion_user_id": str(data["attacker_cu"].id),
            },
            headers=data["headers_member"],
        )
        assert response.status_code == 201
        body = response.json()
        assert body["champion_name"] == "Deadpool"
        assert body["target_champion_name"] == "Wolverine"
        assert body["game_pseudo"] == GAME_PSEUDO_2

    @pytest.mark.asyncio
    async def test_add_synergy_target_not_a_node_attacker_rejected(self):
        """target_champion_user_id must be assigned as a node attacker."""
        data = await _setup_synergy_scenario()
        # Create a champion that is NOT assigned as a node attacker
        random_champ = await push_champion(name="Thor", champion_class="Cosmic")
        random_cu = await push_champion_user(data["member"], random_champ, stars=7, rank=3)

        response = await execute_post_request(
            _synergy_url(data["alliance"].id, data["war"].id),
            payload={
                "champion_user_id": str(data["synergy_cu"].id),
                "target_champion_user_id": str(random_cu.id),
            },
            headers=data["headers_member"],
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_add_synergy_target_champion_not_found(self):
        """target_champion_user_id referencing a non-existent ChampionUser returns 404."""
        data = await _setup_synergy_scenario()
        response = await execute_post_request(
            _synergy_url(data["alliance"].id, data["war"].id),
            payload={
                "champion_user_id": str(data["synergy_cu"].id),
                "target_champion_user_id": str(uuid.uuid4()),
            },
            headers=data["headers_member"],
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_add_synergy_same_provider_and_target_rejected(self):
        """Provider champion cannot be the same as target champion."""
        data = await _setup_synergy_scenario()
        response = await execute_post_request(
            _synergy_url(data["alliance"].id, data["war"].id),
            payload={
                "champion_user_id": str(data["attacker_cu"].id),
                "target_champion_user_id": str(data["attacker_cu"].id),
            },
            headers=data["headers_member"],
        )
        assert response.status_code == 409

    @pytest.mark.asyncio
    async def test_add_synergy_other_member_champion_rejected(self):
        """A user cannot add a champion from a different game account as synergy provider for another user's attacker."""
        data = await _setup_synergy_scenario()
        # owner adds their own champion as provider, targeting member's attacker → different user_ids → 403
        owner_champ = await push_champion(name="Thor", champion_class="Cosmic")
        owner_cu = await push_champion_user(data["owner"], owner_champ, stars=7, rank=3)
        response = await execute_post_request(
            _synergy_url(data["alliance"].id, data["war"].id),
            payload={
                "champion_user_id": str(owner_cu.id),
                "target_champion_user_id": str(data["attacker_cu"].id),
            },
            headers=data["headers_owner"],
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_add_synergy_duplicate_rejected(self):
        """Same champion cannot be synergy provider twice in same war+BG."""
        data = await _setup_synergy_scenario()
        payload = {
            "champion_user_id": str(data["synergy_cu"].id),
            "target_champion_user_id": str(data["attacker_cu"].id),
        }
        await execute_post_request(
            _synergy_url(data["alliance"].id, data["war"].id),
            payload=payload,
            headers=data["headers_member"],
        )
        response = await execute_post_request(
            _synergy_url(data["alliance"].id, data["war"].id),
            payload=payload,
            headers=data["headers_member"],
        )
        assert response.status_code == 409

    @pytest.mark.asyncio
    async def test_add_synergy_defense_conflict_rejected(self):
        """Champion in alliance defense cannot be used as synergy provider."""
        data = await _setup_synergy_scenario()
        # Place synergy champion in regular alliance defense
        defense_champ = await push_champion(name="Captain America", champion_class="Science")
        defense_cu = await push_champion_user(data["member"], defense_champ, stars=7, rank=3)
        await load_objects(
            [
                DefensePlacement(
                    alliance_id=data["alliance"].id,
                    battlegroup=1,
                    node_number=5,
                    game_account_id=data["member"].id,
                    champion_user_id=defense_cu.id,
                )
            ]
        )

        response = await execute_post_request(
            _synergy_url(data["alliance"].id, data["war"].id),
            payload={
                "champion_user_id": str(defense_cu.id),
                "target_champion_user_id": str(data["attacker_cu"].id),
            },
            headers=data["headers_member"],
        )
        assert response.status_code == 409

    @pytest.mark.asyncio
    async def test_add_synergy_slot_limit_enforced(self):
        """Member cannot exceed 3 combined node+synergy attacker slots."""
        data = await _setup_synergy_scenario()
        alliance = data["alliance"]
        war = data["war"]
        member = data["member"]
        headers_member = data["headers_member"]
        headers_owner = data["headers_owner"]

        # Place defenders on nodes 11, 12 and assign 2 more node attackers (total 3)
        for i, (name, cls) in enumerate(
            [("Black Panther", "Cosmic"), ("Captain Marvel", "Cosmic")]
        ):
            champ = await push_champion(name=name, champion_class=cls)
            cu = await push_champion_user(member, champ, stars=7, rank=3)
            await execute_post_request(
                f"/alliances/{alliance.id}/wars/{war.id}/bg/1/place",
                payload={
                    "node_number": 11 + i,
                    "champion_id": str(champ.id),
                    "stars": 7,
                    "rank": 3,
                    "ascension": 0,
                },
                headers=headers_owner,
            )
            await execute_post_request(
                f"/alliances/{alliance.id}/wars/{war.id}/bg/1/node/{11 + i}/attacker",
                payload={"champion_user_id": str(cu.id)},
                headers=headers_member,
            )

        # Now try to add a synergy (would bring total to 4) → should fail
        extra_champ = await push_champion(name="Vision", champion_class="Tech")
        extra_cu = await push_champion_user(member, extra_champ, stars=7, rank=3)
        response = await execute_post_request(
            _synergy_url(alliance.id, war.id),
            payload={
                "champion_user_id": str(extra_cu.id),
                "target_champion_user_id": str(data["attacker_cu"].id),
            },
            headers=headers_member,
        )
        assert response.status_code == 409

    @pytest.mark.asyncio
    async def test_add_synergy_couteau_suisse_counts_as_one_slot(self):
        """Couteau suisse: same champion on a node AND as synergy = 1 slot, not 2."""
        data = await _setup_synergy_scenario()
        alliance = data["alliance"]
        war = data["war"]
        member = data["member"]
        headers_member = data["headers_member"]
        headers_owner = data["headers_owner"]

        # Place defender on node 11 and assign attacker_cu as node attacker (already on node 10)
        # Use attacker_cu (Wolverine) as both node attacker AND synergy provider
        extra_champ = await push_champion(name="Thor", champion_class="Cosmic")
        await execute_post_request(
            f"/alliances/{alliance.id}/wars/{war.id}/bg/1/place",
            payload={
                "node_number": 11,
                "champion_id": str(extra_champ.id),
                "stars": 7,
                "rank": 3,
                "ascension": 0,
            },
            headers=headers_owner,
        )

        # Add synergy where the PROVIDER is the same as the node attacker (couteau suisse)
        # attacker_cu is on node 10; use it also as synergy provider for itself → not valid
        # Instead: use synergy_cu on node 11, and attacker_cu as synergy for synergy_cu on node 11
        another_node_cu = await push_champion_user(member, extra_champ, stars=7, rank=3)
        await execute_post_request(
            f"/alliances/{alliance.id}/wars/{war.id}/bg/1/node/11/attacker",
            payload={"champion_user_id": str(another_node_cu.id)},
            headers=headers_member,
        )
        # Now attacker_cu (node 10) as synergy provider targeting another_node_cu (node 11)
        # attacker_cu is already counted as a node attacker, so using it as synergy doesn't add a slot
        response = await execute_post_request(
            _synergy_url(alliance.id, war.id),
            payload={
                "champion_user_id": str(data["attacker_cu"].id),
                "target_champion_user_id": str(another_node_cu.id),
            },
            headers=headers_member,
        )
        assert response.status_code == 201


# ─── TestRemoveSynergy ────────────────────────────────────


class TestRemoveSynergy:
    @pytest.mark.asyncio
    async def test_remove_synergy_success(self):
        data = await _setup_synergy_scenario()
        await execute_post_request(
            _synergy_url(data["alliance"].id, data["war"].id),
            payload={
                "champion_user_id": str(data["synergy_cu"].id),
                "target_champion_user_id": str(data["attacker_cu"].id),
            },
            headers=data["headers_member"],
        )
        response = await execute_delete_request(
            f"{_synergy_url(data['alliance'].id, data['war'].id)}/{data['synergy_cu'].id}",
            headers=data["headers_member"],
        )
        assert response.status_code == 204

    @pytest.mark.asyncio
    async def test_remove_attacker_last_node_auto_removes_synergy(self):
        """Removing an attacker from their last node auto-removes their synergy provider entry (couteau suisse)."""
        data = await _setup_synergy_scenario()
        alliance = data["alliance"]
        war = data["war"]
        headers_owner = data["headers_owner"]
        headers_member = data["headers_member"]

        # Place defender on node 11 and assign synergy_cu as node attacker (couteau suisse: node fighter + provider)
        second_def = await push_champion(name="Thor", champion_class="Cosmic")
        await execute_post_request(
            f"/alliances/{alliance.id}/wars/{war.id}/bg/1/place",
            payload={
                "node_number": 11,
                "champion_id": str(second_def.id),
                "stars": 7,
                "rank": 3,
                "ascension": 0,
            },
            headers=headers_owner,
        )
        await execute_post_request(
            f"/alliances/{alliance.id}/wars/{war.id}/bg/1/node/11/attacker",
            payload={"champion_user_id": str(data["synergy_cu"].id)},
            headers=headers_member,
        )

        # synergy_cu also provides synergy to attacker_cu
        await execute_post_request(
            _synergy_url(alliance.id, war.id),
            payload={
                "champion_user_id": str(data["synergy_cu"].id),
                "target_champion_user_id": str(data["attacker_cu"].id),
            },
            headers=headers_member,
        )
        get_resp = await execute_get_request(
            _synergy_url(alliance.id, war.id), headers=headers_member
        )
        assert len(get_resp.json()) == 1

        # Remove synergy_cu from their only node (node 11) — this is their last fight
        await execute_delete_request(
            f"/alliances/{alliance.id}/wars/{war.id}/bg/1/node/11/attacker",
            headers=headers_member,
        )

        # Synergy provider entry should be auto-removed
        get_resp2 = await execute_get_request(
            _synergy_url(alliance.id, war.id), headers=headers_member
        )
        assert get_resp2.json() == []

    @pytest.mark.asyncio
    async def test_remove_synergy_not_found_returns_404(self):
        data = await _setup_synergy_scenario()
        response = await execute_delete_request(
            f"{_synergy_url(data['alliance'].id, data['war'].id)}/{uuid.uuid4()}",
            headers=data["headers_member"],
        )
        assert response.status_code == 404


# ─── TestGetSynergy ───────────────────────────────────────


class TestGetSynergy:
    @pytest.mark.asyncio
    async def test_get_synergy_empty(self):
        data = await _setup_synergy_scenario()
        response = await execute_get_request(
            _synergy_url(data["alliance"].id, data["war"].id),
            headers=data["headers_member"],
        )
        assert response.status_code == 200
        assert response.json() == []

    @pytest.mark.asyncio
    async def test_get_synergy_returns_added(self):
        data = await _setup_synergy_scenario()
        await execute_post_request(
            _synergy_url(data["alliance"].id, data["war"].id),
            payload={
                "champion_user_id": str(data["synergy_cu"].id),
                "target_champion_user_id": str(data["attacker_cu"].id),
            },
            headers=data["headers_member"],
        )
        response = await execute_get_request(
            _synergy_url(data["alliance"].id, data["war"].id),
            headers=data["headers_member"],
        )
        assert response.status_code == 200
        body = response.json()
        assert len(body) == 1
        assert body[0]["champion_name"] == "Deadpool"
        assert body[0]["target_champion_name"] == "Wolverine"


# ─── TestSynergyBans ──────────────────────────────────────


class TestSynergyBans:
    @pytest.mark.asyncio
    async def test_add_synergy_banned_champion_rejected(self):
        """Synergy provider whose champion is banned in the war is rejected with 409."""
        data = await _setup_synergy_scenario()
        alliance = data["alliance"]
        war = data["war"]
        headers_owner = data["headers_owner"]
        headers_member = data["headers_member"]

        # End current war, create a new one banning Deadpool (synergy_cu's champion)
        await execute_post_request(
            f"/alliances/{alliance.id}/wars/{war.id}/end",
            payload={"win": True},
            headers=headers_owner,
        )
        deadpool_champ_id = data["synergy_cu"].champion_id
        new_war_resp = await execute_post_request(
            f"/alliances/{alliance.id}/wars",
            payload={
                "opponent_name": "Ban Synergy War",
                "banned_champion_ids": [str(deadpool_champ_id)],
            },
            headers=headers_owner,
        )
        assert new_war_resp.status_code == 201
        new_war_id = new_war_resp.json()["id"]

        # Place defender on node 10 and assign attacker_cu
        await execute_post_request(
            f"/alliances/{alliance.id}/wars/{new_war_id}/bg/1/place",
            payload={
                "node_number": 10,
                "champion_id": str(data["attacker_cu"].champion_id),
                "stars": 7,
                "rank": 3,
                "ascension": 0,
            },
            headers=headers_owner,
        )
        await execute_post_request(
            f"/alliances/{alliance.id}/wars/{new_war_id}/bg/1/node/10/attacker",
            payload={"champion_user_id": str(data["attacker_cu"].id)},
            headers=headers_member,
        )

        # Try to add banned Deadpool as synergy provider
        response = await execute_post_request(
            f"/alliances/{alliance.id}/wars/{new_war_id}/bg/1/synergy",
            payload={
                "champion_user_id": str(data["synergy_cu"].id),
                "target_champion_user_id": str(data["attacker_cu"].id),
            },
            headers=headers_member,
        )
        assert response.status_code == 409

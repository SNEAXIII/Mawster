"""Integration tests for war attacker endpoints."""

import uuid

import pytest

from src.enums.Roles import Roles
from src.models import User
from src.models.DefensePlacement import DefensePlacement
from src.models.War import War
from tests.integration.endpoints.setup.game_setup import (
    get_game_account,
    push_alliance_with_owner,
    push_champion,
    push_champion_user,
    push_member,
    push_officer,
)
from tests.integration.endpoints.setup.user_setup import get_generic_user, push_user2
from tests.utils.utils_client import (
    create_auth_headers,
    execute_delete_request,
    execute_get_request,
    execute_patch_request,
    execute_post_request,
)
from tests.utils.utils_constant import (
    ALLIANCE_NAME,
    ALLIANCE_TAG,
    GAME_PSEUDO,
    GAME_PSEUDO_2,
    USER2_ID,
    USER_ID,
)
from tests.utils.utils_db import load_objects

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

    @pytest.mark.asyncio
    async def test_available_attackers_replacement_slot_excluded_from_limit(self):
        data = await _setup_attacker_scenario()
        headers_member = create_auth_headers(user_id=str(USER2_ID))
        await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/1/node/10/attacker",
            payload={"champion_user_id": str(data["champion_user"].id)},
            headers=headers_member,
        )
        resp = await execute_get_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/1/available-attackers?node_number=10",
            headers=headers_member,
        )
        assert resp.status_code == 200
        ids = [a["champion_user_id"] for a in resp.json()]
        assert str(data["champion_user"].id) in ids

    @pytest.mark.asyncio
    async def test_available_attackers_filters_champion_at_three_limit(self):
        data = await _setup_attacker_scenario()
        headers_member = create_auth_headers(user_id=str(USER2_ID))
        headers_owner = create_auth_headers(user_id=str(USER_ID))
        alliance = data["alliance"]
        war = data["war"]
        await execute_post_request(
            f"/alliances/{alliance.id}/wars/{war.id}/bg/1/node/10/attacker",
            payload={"champion_user_id": str(data["champion_user"].id)},
            headers=headers_member,
        )
        for node, name in ((11, "Iron Man"), (12, "Captain America")):
            champ = await push_champion(name=name, champion_class="Tech")
            cu = await push_champion_user(data["member"], champ)
            await execute_post_request(
                f"/alliances/{alliance.id}/wars/{war.id}/bg/1/place",
                payload={
                    "node_number": node,
                    "champion_id": str(champ.id),
                    "stars": 7,
                    "rank": 3,
                    "ascension": 0,
                },
                headers=headers_owner,
            )
            await execute_post_request(
                f"/alliances/{alliance.id}/wars/{war.id}/bg/1/node/{node}/attacker",
                payload={"champion_user_id": str(cu.id)},
                headers=headers_member,
            )
        champ4 = await push_champion(name="Thor", champion_class="Cosmic")
        cu4 = await push_champion_user(data["member"], champ4)
        resp = await execute_get_request(
            f"/alliances/{alliance.id}/wars/{war.id}/bg/1/available-attackers",
            headers=headers_member,
        )
        assert resp.status_code == 200
        ids = [a["champion_user_id"] for a in resp.json()]
        assert str(cu4.id) not in ids


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

    @pytest.mark.asyncio
    async def test_assign_attacker_unknown_champion_user_returns_404(self):
        data = await _setup_attacker_scenario()
        headers_member = create_auth_headers(user_id=str(USER2_ID))
        resp = await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/1/node/10/attacker",
            payload={"champion_user_id": str(uuid.uuid4())},
            headers=headers_member,
        )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_assign_attacker_champion_wrong_bg_returns_403(self):
        data = await _setup_attacker_scenario()
        headers_owner = create_auth_headers(user_id=str(USER_ID))
        headers_member = create_auth_headers(user_id=str(USER2_ID))
        await execute_patch_request(
            f"/alliances/{data['alliance'].id}/members/{data['member'].id}/group",
            payload={"group": 2},
            headers=headers_owner,
        )
        resp = await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/1/node/10/attacker",
            payload={"champion_user_id": str(data["champion_user"].id)},
            headers=headers_member,
        )
        assert resp.status_code == 403


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

    @pytest.mark.asyncio
    async def test_remove_attacker_node_without_placement_returns_404(self):
        data = await _setup_attacker_scenario()
        headers_member = create_auth_headers(user_id=str(USER2_ID))
        resp = await execute_delete_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/1/node/99/attacker",
            headers=headers_member,
        )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_remove_attacker_cleans_up_prefight_entries(self):
        data = await _setup_attacker_scenario()
        headers_member = create_auth_headers(user_id=str(USER2_ID))
        alliance = data["alliance"]
        war = data["war"]
        await execute_post_request(
            f"/alliances/{alliance.id}/wars/{war.id}/bg/1/node/10/attacker",
            payload={"champion_user_id": str(data["champion_user"].id)},
            headers=headers_member,
        )
        prefight_champ = await push_champion(
            name="Medusa", champion_class="Cosmic", has_prefight=True
        )
        prefight_cu = await push_champion_user(data["member"], prefight_champ)
        await execute_post_request(
            f"/alliances/{alliance.id}/wars/{war.id}/bg/1/prefight",
            payload={"champion_user_id": str(prefight_cu.id), "target_node_number": 10},
            headers=headers_member,
        )
        await execute_delete_request(
            f"/alliances/{alliance.id}/wars/{war.id}/bg/1/node/10/attacker",
            headers=headers_member,
        )
        prefight_resp = await execute_get_request(
            f"/alliances/{alliance.id}/wars/{war.id}/bg/1/prefight",
            headers=headers_member,
        )
        assert prefight_resp.json() == []

    @pytest.mark.asyncio
    async def test_remove_attacker_cleans_up_target_synergy(self):
        """Removing an attacker cascades and deletes synergy entries that targeted that attacker (L796-798)."""
        data = await _setup_attacker_scenario()
        headers_member = create_auth_headers(user_id=str(USER2_ID))
        alliance = data["alliance"]
        war = data["war"]

        # Assign attacker on node 10
        await execute_post_request(
            f"/alliances/{alliance.id}/wars/{war.id}/bg/1/node/10/attacker",
            payload={"champion_user_id": str(data["champion_user"].id)},
            headers=headers_member,
        )

        # Add member's second champion as synergy provider targeting the node attacker
        synergy_champ = await push_champion(name="Deadpool", champion_class="Mutant")
        synergy_cu = await push_champion_user(data["member"], synergy_champ, stars=7, rank=3)
        await execute_post_request(
            f"/alliances/{alliance.id}/wars/{war.id}/bg/1/synergy",
            payload={
                "champion_user_id": str(synergy_cu.id),
                "target_champion_user_id": str(data["champion_user"].id),
            },
            headers=headers_member,
        )

        # Verify synergy exists
        synergy_resp = await execute_get_request(
            f"/alliances/{alliance.id}/wars/{war.id}/bg/1/synergy",
            headers=headers_member,
        )
        assert len(synergy_resp.json()) == 1

        # Remove the attacker — must cascade-delete the synergy targeting them
        await execute_delete_request(
            f"/alliances/{alliance.id}/wars/{war.id}/bg/1/node/10/attacker",
            headers=headers_member,
        )

        # Synergy must be gone
        synergy_resp2 = await execute_get_request(
            f"/alliances/{alliance.id}/wars/{war.id}/bg/1/synergy",
            headers=headers_member,
        )
        assert synergy_resp2.json() == []


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


# ─── TestBigThingFormat ───────────────────────────────────


class TestBigThingFormat:
    """Under an active big_thing season, the attacker cap is 2 (not 3)."""

    @pytest.mark.asyncio
    async def test_big_thing_attacker_cap_is_2(self):
        """Member can assign 2 attackers; the 3rd returns 409."""
        # Setup: alliance + war + defenders (big_thing has nodes 1-10)
        # _setup_alliance loads the owner user (USER_ID); admin headers use JWT role override.
        data = await _setup_alliance()
        alliance = data["alliance"]
        member = data["member"]
        headers_owner = create_auth_headers(user_id=str(USER_ID))
        headers_member = create_auth_headers(user_id=str(USER2_ID))
        admin_headers = create_auth_headers(user_id=str(USER_ID), role=Roles.ADMIN)

        # Activate a big_thing season
        create_resp = await execute_post_request(
            "/admin/seasons",
            payload={"number": 99, "format": "big_thing"},
            headers=admin_headers,
        )
        assert create_resp.status_code == 201
        season_id = create_resp.json()["id"]
        activate_resp = await execute_patch_request(
            f"/admin/seasons/{season_id}/open",
            payload={},
            headers=admin_headers,
        )
        assert activate_resp.status_code == 200

        # Assign BG1 to owner and member
        await execute_patch_request(
            f"/alliances/{alliance.id}/members/{data['owner'].id}/group",
            payload={"group": 1},
            headers=headers_owner,
        )
        await execute_patch_request(
            f"/alliances/{alliance.id}/members/{member.id}/group",
            payload={"group": 1},
            headers=headers_owner,
        )

        # Create war
        war = War(
            id=uuid.uuid4(),
            alliance_id=alliance.id,
            opponent_name="Big Enemy",
            created_by_id=data["owner"].id,
        )
        await load_objects([war])

        # Place defenders on nodes 1, 2, 3 using 3 distinct defender champions
        defender_champs = [
            ("Defender One", "Cosmic"),
            ("Defender Two", "Tech"),
            ("Defender Three", "Mystic"),
        ]
        for node, (name, cls) in enumerate(defender_champs, start=1):
            dc = await push_champion(name=name, champion_class=cls)
            resp = await execute_post_request(
                f"/alliances/{alliance.id}/wars/{war.id}/bg/1/place",
                payload={
                    "node_number": node,
                    "champion_id": str(dc.id),
                    "stars": 6,
                    "rank": 3,
                    "ascension": 0,
                },
                headers=headers_owner,
            )
            assert resp.status_code == 201, f"Place defender on node {node} failed: {resp.json()}"

        # Create 3 attacker champion_users for member
        attacker_cus = []
        for _i, (name, cls) in enumerate(
            [("Attacker A", "Science"), ("Attacker B", "Mutant"), ("Attacker C", "Skill")]
        ):
            ac = await push_champion(name=name, champion_class=cls)
            cu = await push_champion_user(member, ac, stars=6, rank=3)
            attacker_cus.append(cu)

        # Assign attacker 1 → node 1: must succeed
        r1 = await execute_post_request(
            f"/alliances/{alliance.id}/wars/{war.id}/bg/1/node/1/attacker",
            payload={"champion_user_id": str(attacker_cus[0].id)},
            headers=headers_member,
        )
        assert r1.status_code == 200, f"1st attacker failed: {r1.json()}"

        # Assign attacker 2 → node 2: must succeed
        r2 = await execute_post_request(
            f"/alliances/{alliance.id}/wars/{war.id}/bg/1/node/2/attacker",
            payload={"champion_user_id": str(attacker_cus[1].id)},
            headers=headers_member,
        )
        assert r2.status_code == 200, f"2nd attacker failed: {r2.json()}"

        # Assign attacker 3 → node 3: must fail with 409 (cap is 2 in big_thing)
        r3 = await execute_post_request(
            f"/alliances/{alliance.id}/wars/{war.id}/bg/1/node/3/attacker",
            payload={"champion_user_id": str(attacker_cus[2].id)},
            headers=headers_member,
        )
        assert r3.status_code == 409, f"Expected 409 but got {r3.status_code}: {r3.json()}"


# ─── TestGetCurrentWar ────────────────────────────────────

"""Integration tests for defense placement endpoints."""
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
    push_champion
)
from tests.integration.endpoints.setup.user_setup import get_generic_user, push_user2
from tests.utils.utils_db import load_objects
from src.models import User
from src.models.ChampionUser import ChampionUser

IRON_MAN = "Iron Man"

# ─── Helpers ──────────────────────────────────────────────

async def _setup_alliance_with_bg(
    owner_user_id=USER_ID,
    member_user_id=USER2_ID,
    battlegroup=1,
):
    """Create alliance + owner in BG + member in BG + 2 champions each."""
    # Insert User rows so AuthService.get_current_user_in_jwt can find them
    await load_objects([get_generic_user(is_base_id=True)])
    await push_user2()

    alliance, owner = await push_alliance_with_owner(
        user_id=owner_user_id,
        game_pseudo=GAME_PSEUDO,
        alliance_name=ALLIANCE_NAME,
        alliance_tag=ALLIANCE_TAG,
    )
    # Set owner to BG
    owner.alliance_group = battlegroup
    await load_objects([owner])

    # Add officer
    await push_officer(alliance, owner)

    # Add member in same BG
    member = await push_member(
        alliance, user_id=member_user_id, game_pseudo=GAME_PSEUDO_2
    )
    member.alliance_group = battlegroup
    await load_objects([member])

    # Create champions
    champ1 = await push_champion(name="Spider-Man", champion_class="Science")
    champ2 = await push_champion(name="Wolverine", champion_class="Mutant")
    champ3 = await push_champion(name=IRON_MAN, champion_class="Tech")

    # Add to rosters
    cu_owner1 = ChampionUser(
        id=uuid.uuid4(),
        game_account_id=owner.id,
        champion_id=champ1.id,
        stars=7,
        rank=3,
    )
    cu_owner2 = ChampionUser(
        id=uuid.uuid4(),
        game_account_id=owner.id,
        champion_id=champ2.id,
        stars=6,
        rank=5,
    )
    cu_member1 = ChampionUser(
        id=uuid.uuid4(),
        game_account_id=member.id,
        champion_id=champ1.id,
        stars=7,
        rank=2,
    )
    cu_member2 = ChampionUser(
        id=uuid.uuid4(),
        game_account_id=member.id,
        champion_id=champ3.id,
        stars=7,
        rank=1,
    )
    await load_objects([cu_owner1, cu_owner2, cu_member1, cu_member2])

    return {
        "alliance": alliance,
        "owner": owner,
        "member": member,
        "champ1": champ1,
        "champ2": champ2,
        "champ3": champ3,
        "cu_owner1": cu_owner1,
        "cu_owner2": cu_owner2,
        "cu_member1": cu_member1,
        "cu_member2": cu_member2,
    }


# ─── Test classes ─────────────────────────────────────────

class TestGetDefense:
    """GET /alliances/{id}/defense/bg/{bg}"""

    @pytest.mark.asyncio
    async def test_get_defense_empty(self):
        data = await _setup_alliance_with_bg()
        headers = create_auth_headers(user_id=str(USER_ID))
        response = await execute_get_request(
            f"/alliances/{data['alliance'].id}/defense/bg/1",
            headers=headers,
        )
        assert response.status_code == 200
        body = response.json()
        assert body["battlegroup"] == 1
        assert body["placements"] == []
        assert body["member_defender_counts"] == {}

    @pytest.mark.asyncio
    async def test_get_defense_not_member(self):
        data = await _setup_alliance_with_bg()
        # Create a real user that is NOT a member of the alliance
        other_user_id = uuid.uuid4()
        other_login = "outsider"
        other_email = "outsider@test.com"
        other_user = User(
            id=other_user_id,
            login=other_login,
            email=other_email,
            discord_id="outsider_discord",
            role="user",
        )
        await load_objects([other_user])
        headers = create_auth_headers(user_id=str(other_user_id))
        response = await execute_get_request(
            f"/alliances/{data['alliance'].id}/defense/bg/1",
            headers=headers,
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_get_defense_invalid_bg(self):
        data = await _setup_alliance_with_bg()
        headers = create_auth_headers(user_id=str(USER_ID))
        response = await execute_get_request(
            f"/alliances/{data['alliance'].id}/defense/bg/4",
            headers=headers,
        )
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_get_defense_includes_preferred_attacker(self):
        """GET defense includes is_preferred_attacker for each placement."""
        data = await _setup_alliance_with_bg()
        data["cu_owner1"].is_preferred_attacker = True
        await load_objects([data["cu_owner1"]])

        headers = create_auth_headers(user_id=str(USER_ID))
        # Place a preferred champion
        await execute_post_request(
            f"/alliances/{data['alliance'].id}/defense/bg/1/place",
            payload={
                "node_number": 1,
                "champion_user_id": str(data["cu_owner1"].id),
                "game_account_id": str(data["owner"].id),
            },
            headers=headers,
        )
        # Place a non-preferred champion
        await execute_post_request(
            f"/alliances/{data['alliance'].id}/defense/bg/1/place",
            payload={
                "node_number": 2,
                "champion_user_id": str(data["cu_owner2"].id),
                "game_account_id": str(data["owner"].id),
            },
            headers=headers,
        )

        response = await execute_get_request(
            f"/alliances/{data['alliance'].id}/defense/bg/1",
            headers=headers,
        )
        assert response.status_code == 200
        placements = response.json()["placements"]
        assert len(placements) == 2
        p_map = {p["node_number"]: p for p in placements}
        assert p_map[1]["is_preferred_attacker"] is True
        assert p_map[2]["is_preferred_attacker"] is False


class TestPlaceDefender:
    """POST /alliances/{id}/defense/bg/{bg}/place"""

    @pytest.mark.asyncio
    async def test_place_defender_success(self):
        data = await _setup_alliance_with_bg()
        headers = create_auth_headers(user_id=str(USER_ID))
        response = await execute_post_request(
            f"/alliances/{data['alliance'].id}/defense/bg/1/place",
            payload={
                "node_number": 1,
                "champion_user_id": str(data["cu_owner1"].id),
                "game_account_id": str(data["owner"].id),
            },
            headers=headers,
        )
        assert response.status_code == 201
        body = response.json()
        assert body["node_number"] == 1
        assert body["champion_name"] == "Spider-Man"
        assert body["rarity"] == "7r3"
        assert body["game_pseudo"] == GAME_PSEUDO
        assert body["is_preferred_attacker"] is False

    @pytest.mark.asyncio
    async def test_place_preferred_attacker_flag_in_response(self):
        """Placement response includes is_preferred_attacker when champion is flagged."""
        data = await _setup_alliance_with_bg()
        # Mark cu_owner1 as preferred attacker
        data["cu_owner1"].is_preferred_attacker = True
        await load_objects([data["cu_owner1"]])

        headers = create_auth_headers(user_id=str(USER_ID))
        response = await execute_post_request(
            f"/alliances/{data['alliance'].id}/defense/bg/1/place",
            payload={
                "node_number": 1,
                "champion_user_id": str(data["cu_owner1"].id),
                "game_account_id": str(data["owner"].id),
            },
            headers=headers,
        )
        assert response.status_code == 201
        body = response.json()
        assert body["is_preferred_attacker"] is True

    @pytest.mark.asyncio
    async def test_place_defender_replaces_existing_on_same_node(self):
        data = await _setup_alliance_with_bg()
        headers = create_auth_headers(user_id=str(USER_ID))

        # Place first
        await execute_post_request(
            f"/alliances/{data['alliance'].id}/defense/bg/1/place",
            payload={
                "node_number": 5,
                "champion_user_id": str(data["cu_owner1"].id),
                "game_account_id": str(data["owner"].id),
            },
            headers=headers,
        )

        # Place different champion on same node
        response = await execute_post_request(
            f"/alliances/{data['alliance'].id}/defense/bg/1/place",
            payload={
                "node_number": 5,
                "champion_user_id": str(data["cu_owner2"].id),
                "game_account_id": str(data["owner"].id),
            },
            headers=headers,
        )
        assert response.status_code == 201
        body = response.json()
        assert body["champion_name"] == "Wolverine"

    @pytest.mark.asyncio
    async def test_place_defender_duplicate_champion(self):
        data = await _setup_alliance_with_bg()
        headers = create_auth_headers(user_id=str(USER_ID))

        # Place on node 1
        await execute_post_request(
            f"/alliances/{data['alliance'].id}/defense/bg/1/place",
            payload={
                "node_number": 1,
                "champion_user_id": str(data["cu_owner1"].id),
                "game_account_id": str(data["owner"].id),
            },
            headers=headers,
        )

        # Try to place same champion on node 2
        response = await execute_post_request(
            f"/alliances/{data['alliance'].id}/defense/bg/1/place",
            payload={
                "node_number": 2,
                "champion_user_id": str(data["cu_owner1"].id),
                "game_account_id": str(data["owner"].id),
            },
            headers=headers,
        )
        assert response.status_code == 409

    @pytest.mark.asyncio
    async def test_place_defender_cross_owner_duplicate_blocked(self):
        """Same champion_id placed by one owner blocks ALL other owners."""
        data = await _setup_alliance_with_bg()
        headers = create_auth_headers(user_id=str(USER_ID))

        # Place owner's Spider-Man on node 1
        await execute_post_request(
            f"/alliances/{data['alliance'].id}/defense/bg/1/place",
            payload={
                "node_number": 1,
                "champion_user_id": str(data["cu_owner1"].id),
                "game_account_id": str(data["owner"].id),
            },
            headers=headers,
        )

        # Attempt to place MEMBER's Spider-Man (same champion_id) on node 2 → must be 409
        response = await execute_post_request(
            f"/alliances/{data['alliance'].id}/defense/bg/1/place",
            payload={
                "node_number": 2,
                "champion_user_id": str(data["cu_member1"].id),
                "game_account_id": str(data["member"].id),
            },
            headers=headers,
        )
        assert response.status_code == 409

    @pytest.mark.asyncio
    async def test_place_defender_wrong_player(self):
        """Champion doesn't belong to the specified game account."""
        data = await _setup_alliance_with_bg()
        headers = create_auth_headers(user_id=str(USER_ID))
        response = await execute_post_request(
            f"/alliances/{data['alliance'].id}/defense/bg/1/place",
            payload={
                "node_number": 1,
                "champion_user_id": str(data["cu_member1"].id),  # belongs to member
                "game_account_id": str(data["owner"].id),  # but assigning to owner
            },
            headers=headers,
        )
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_place_defender_for_other_as_officer(self):
        """Officer can place defenders for other members."""
        data = await _setup_alliance_with_bg()
        headers = create_auth_headers(user_id=str(USER_ID))
        response = await execute_post_request(
            f"/alliances/{data['alliance'].id}/defense/bg/1/place",
            payload={
                "node_number": 10,
                "champion_user_id": str(data["cu_member1"].id),
                "game_account_id": str(data["member"].id),
            },
            headers=headers,
        )
        assert response.status_code == 201
        body = response.json()
        assert body["game_pseudo"] == GAME_PSEUDO_2

    @pytest.mark.asyncio
    async def test_place_defender_for_other_as_non_officer_denied(self):
        """Non-officer cannot place for another player."""
        data = await _setup_alliance_with_bg()
        headers = create_auth_headers(user_id=str(USER2_ID))
        response = await execute_post_request(
            f"/alliances/{data['alliance'].id}/defense/bg/1/place",
            payload={
                "node_number": 10,
                "champion_user_id": str(data["cu_owner1"].id),
                "game_account_id": str(data["owner"].id),
            },
            headers=headers,
        )
        assert response.status_code == 403


class TestRemoveDefender:
    """DELETE /alliances/{id}/defense/bg/{bg}/node/{node}"""

    @pytest.mark.asyncio
    async def test_remove_defender_success(self):
        data = await _setup_alliance_with_bg()
        headers = create_auth_headers(user_id=str(USER_ID))

        # Place first
        await execute_post_request(
            f"/alliances/{data['alliance'].id}/defense/bg/1/place",
            payload={
                "node_number": 3,
                "champion_user_id": str(data["cu_owner1"].id),
                "game_account_id": str(data["owner"].id),
            },
            headers=headers,
        )

        # Remove
        response = await execute_delete_request(
            f"/alliances/{data['alliance'].id}/defense/bg/1/node/3",
            headers=headers,
        )
        assert response.status_code == 204

    @pytest.mark.asyncio
    async def test_remove_defender_not_found(self):
        data = await _setup_alliance_with_bg()
        headers = create_auth_headers(user_id=str(USER_ID))
        response = await execute_delete_request(
            f"/alliances/{data['alliance'].id}/defense/bg/1/node/99",
            headers=headers,
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_remove_defender_non_officer_denied(self):
        data = await _setup_alliance_with_bg()
        owner_headers = create_auth_headers(user_id=str(USER_ID))
        member_headers = create_auth_headers(user_id=str(USER2_ID))

        # Owner places
        await execute_post_request(
            f"/alliances/{data['alliance'].id}/defense/bg/1/place",
            payload={
                "node_number": 3,
                "champion_user_id": str(data["cu_owner1"].id),
                "game_account_id": str(data["owner"].id),
            },
            headers=owner_headers,
        )

        # Member tries to remove
        response = await execute_delete_request(
            f"/alliances/{data['alliance'].id}/defense/bg/1/node/3",
            headers=member_headers,
        )
        assert response.status_code == 403


class TestClearDefense:
    """DELETE /alliances/{id}/defense/bg/{bg}/clear"""

    @pytest.mark.asyncio
    async def test_clear_defense_success(self):
        data = await _setup_alliance_with_bg()
        headers = create_auth_headers(user_id=str(USER_ID))

        # Place 2 defenders
        await execute_post_request(
            f"/alliances/{data['alliance'].id}/defense/bg/1/place",
            payload={
                "node_number": 1,
                "champion_user_id": str(data["cu_owner1"].id),
                "game_account_id": str(data["owner"].id),
            },
            headers=headers,
        )
        await execute_post_request(
            f"/alliances/{data['alliance'].id}/defense/bg/1/place",
            payload={
                "node_number": 2,
                "champion_user_id": str(data["cu_owner2"].id),
                "game_account_id": str(data["owner"].id),
            },
            headers=headers,
        )

        # Clear
        response = await execute_delete_request(
            f"/alliances/{data['alliance'].id}/defense/bg/1/clear",
            headers=headers,
        )
        assert response.status_code == 204

        # Verify empty
        get_response = await execute_get_request(
            f"/alliances/{data['alliance'].id}/defense/bg/1",
            headers=headers,
        )
        assert get_response.json()["placements"] == []


class TestAvailableChampions:
    """GET /alliances/{id}/defense/bg/{bg}/available-champions"""

    @pytest.mark.asyncio
    async def test_get_available_champions(self):
        data = await _setup_alliance_with_bg()
        headers = create_auth_headers(user_id=str(USER_ID))
        response = await execute_get_request(
            f"/alliances/{data['alliance'].id}/defense/bg/1/available-champions",
            headers=headers,
        )
        assert response.status_code == 200
        body = response.json()
        # Should have 3 champions: Spider-Man (2 owners), Wolverine (1 owner), Iron Man (1 owner)
        assert len(body) == 3

        # Find Spider-Man — should have 2 owners, 7★ first
        spidey = next(c for c in body if c["champion_name"] == "Spider-Man")
        assert len(spidey["owners"]) == 2
        assert spidey["owners"][0]["stars"] == 7
        assert spidey["owners"][0]["rank"] == 3  # owner has 7r3

    @pytest.mark.asyncio
    async def test_available_excludes_placed(self):
        data = await _setup_alliance_with_bg()
        headers = create_auth_headers(user_id=str(USER_ID))

        # Place owner's Spider-Man
        await execute_post_request(
            f"/alliances/{data['alliance'].id}/defense/bg/1/place",
            payload={
                "node_number": 1,
                "champion_user_id": str(data["cu_owner1"].id),
                "game_account_id": str(data["owner"].id),
            },
            headers=headers,
        )

        response = await execute_get_request(
            f"/alliances/{data['alliance'].id}/defense/bg/1/available-champions",
            headers=headers,
        )
        body = response.json()
        # Dedup by champion_id: Spider-Man entirely excluded (both owner's and member's copy)
        champion_names = [c["champion_name"] for c in body]
        assert "Spider-Man" not in champion_names
        # Only Wolverine and Iron Man remain
        assert len(body) == 2


class TestBgMembers:
    """GET /alliances/{id}/defense/bg/{bg}/members"""

    @pytest.mark.asyncio
    async def test_get_bg_members(self):
        data = await _setup_alliance_with_bg()
        headers = create_auth_headers(user_id=str(USER_ID))
        response = await execute_get_request(
            f"/alliances/{data['alliance'].id}/defense/bg/1/members",
            headers=headers,
        )
        assert response.status_code == 200
        body = response.json()
        assert len(body) == 2
        pseudos = {m["game_pseudo"] for m in body}
        assert GAME_PSEUDO in pseudos
        assert GAME_PSEUDO_2 in pseudos
        for m in body:
            assert m["defender_count"] == 0
            assert m["max_defenders"] == 5


class TestExportDefense:
    """GET /alliances/{id}/defense/bg/{bg}/export"""

    @pytest.mark.asyncio
    async def test_export_empty(self):
        """Export when no defenders are placed returns []."""
        data = await _setup_alliance_with_bg()
        headers = create_auth_headers(user_id=str(USER_ID))
        response = await execute_get_request(
            f"/alliances/{data['alliance'].id}/defense/bg/1/export",
            headers=headers,
        )
        assert response.status_code == 200
        assert response.json() == []

    @pytest.mark.asyncio
    async def test_export_after_placing(self):
        """Export returns one DefenseExportItem per placement."""
        data = await _setup_alliance_with_bg()
        headers = create_auth_headers(user_id=str(USER_ID))

        # Place 2 defenders (use different champions to avoid cross-owner dup)
        await execute_post_request(
            f"/alliances/{data['alliance'].id}/defense/bg/1/place",
            payload={
                "node_number": 1,
                "champion_user_id": str(data["cu_owner1"].id),
                "game_account_id": str(data["owner"].id),
            },
            headers=headers,
        )
        await execute_post_request(
            f"/alliances/{data['alliance'].id}/defense/bg/1/place",
            payload={
                "node_number": 10,
                "champion_user_id": str(data["cu_member2"].id),
                "game_account_id": str(data["member"].id),
            },
            headers=headers,
        )

        response = await execute_get_request(
            f"/alliances/{data['alliance'].id}/defense/bg/1/export",
            headers=headers,
        )
        assert response.status_code == 200
        items = response.json()
        assert len(items) == 2
        names = {i["champion_name"] for i in items}
        assert "Spider-Man" in names
        assert IRON_MAN in names
        nodes = {i["node_number"] for i in items}
        assert nodes == {1, 10}
        # Verify portable format (no IDs)
        for i in items:
            assert "id" not in i
            assert "champion_user_id" not in i
            assert "owner_name" in i
            assert "rarity" in i

    @pytest.mark.asyncio
    async def test_export_not_member_denied(self):
        """Non-member cannot export."""
        data = await _setup_alliance_with_bg()
        other_user_id = uuid.uuid4()
        other_user = User(
            id=other_user_id, login="outsider2", email="outsider2@test.com",
            discord_id="outsider2", role="user",
        )
        await load_objects([other_user])
        headers = create_auth_headers(user_id=str(other_user_id))
        response = await execute_get_request(
            f"/alliances/{data['alliance'].id}/defense/bg/1/export",
            headers=headers,
        )
        assert response.status_code == 403


class TestImportDefense:
    """POST /alliances/{id}/defense/bg/{bg}/import"""

    @pytest.mark.asyncio
    async def test_import_valid(self):
        """Import valid placements → success report with correct counts."""
        data = await _setup_alliance_with_bg()
        headers = create_auth_headers(user_id=str(USER_ID))

        payload = {
            "placements": [
                {
                    "champion_name": "Spider-Man",
                    "rarity": "7r3",
                    "node_number": 1,
                    "owner_name": GAME_PSEUDO,
                },
                {
                    "champion_name": IRON_MAN,
                    "rarity": "7r1",
                    "node_number": 5,
                    "owner_name": GAME_PSEUDO_2,
                },
            ]
        }

        response = await execute_post_request(
            f"/alliances/{data['alliance'].id}/defense/bg/1/import",
            payload=payload,
            headers=headers,
        )
        assert response.status_code == 200
        body = response.json()
        assert body["success_count"] == 2
        assert body["error_count"] == 0
        assert body["errors"] == []
        assert len(body["before"]) == 0  # was empty before
        assert len(body["after"]) == 2
        # After items should have report fields (class + image)
        for item in body["after"]:
            assert "champion_class" in item
            assert "champion_image_url" in item

    @pytest.mark.asyncio
    async def test_import_clears_previous(self):
        """Import clears existing defense before placing new ones."""
        data = await _setup_alliance_with_bg()
        headers = create_auth_headers(user_id=str(USER_ID))

        # Place one defender first
        await execute_post_request(
            f"/alliances/{data['alliance'].id}/defense/bg/1/place",
            payload={
                "node_number": 1,
                "champion_user_id": str(data["cu_owner1"].id),
                "game_account_id": str(data["owner"].id),
            },
            headers=headers,
        )

        # Import different placements
        payload = {
            "placements": [
                {
                    "champion_name": "Wolverine",
                    "rarity": "6r5",
                    "node_number": 10,
                    "owner_name": GAME_PSEUDO,
                },
            ]
        }

        response = await execute_post_request(
            f"/alliances/{data['alliance'].id}/defense/bg/1/import",
            payload=payload,
            headers=headers,
        )
        assert response.status_code == 200
        body = response.json()
        assert len(body["before"]) == 1  # had Spider-Man on node 1
        assert body["before"][0]["champion_name"] == "Spider-Man"
        assert len(body["after"]) == 1   # now Wolverine on node 10
        assert body["after"][0]["champion_name"] == "Wolverine"

    @pytest.mark.asyncio
    async def test_import_with_unknown_champion_error(self):
        """Importing an unknown champion returns an error for that entry."""
        data = await _setup_alliance_with_bg()
        headers = create_auth_headers(user_id=str(USER_ID))

        payload = {
            "placements": [
                {
                    "champion_name": "NonExistentHero",
                    "rarity": "7r3",
                    "node_number": 1,
                    "owner_name": GAME_PSEUDO,
                },
                {
                    "champion_name": "Spider-Man",
                    "rarity": "7r3",
                    "node_number": 2,
                    "owner_name": GAME_PSEUDO,
                },
            ]
        }

        response = await execute_post_request(
            f"/alliances/{data['alliance'].id}/defense/bg/1/import",
            payload=payload,
            headers=headers,
        )
        assert response.status_code == 200
        body = response.json()
        assert body["success_count"] == 1
        assert body["error_count"] == 1
        assert len(body["errors"]) == 1
        assert body["errors"][0]["champion_name"] == "NonExistentHero"
        assert "Unknown champion" in body["errors"][0]["reason"]

    @pytest.mark.asyncio
    async def test_import_unknown_player_error(self):
        """Importing for an unknown player returns an error."""
        data = await _setup_alliance_with_bg()
        headers = create_auth_headers(user_id=str(USER_ID))

        payload = {
            "placements": [
                {
                    "champion_name": "Spider-Man",
                    "rarity": "7r3",
                    "node_number": 1,
                    "owner_name": "GhostPlayer",
                },
            ]
        }

        response = await execute_post_request(
            f"/alliances/{data['alliance'].id}/defense/bg/1/import",
            payload=payload,
            headers=headers,
        )
        assert response.status_code == 200
        body = response.json()
        assert body["success_count"] == 0
        assert body["error_count"] == 1
        assert "not found" in body["errors"][0]["reason"]

    @pytest.mark.asyncio
    async def test_import_non_officer_denied(self):
        """Non-officer cannot import."""
        data = await _setup_alliance_with_bg()
        headers = create_auth_headers(user_id=str(USER2_ID))

        payload = {
            "placements": [
                {
                    "champion_name": "Spider-Man",
                    "rarity": "7r2",
                    "node_number": 1,
                    "owner_name": GAME_PSEUDO_2,
                },
            ]
        }

        response = await execute_post_request(
            f"/alliances/{data['alliance'].id}/defense/bg/1/import",
            payload=payload,
            headers=headers,
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_import_empty_placements_rejected(self):
        """Import with empty placements array is rejected (422 validation)."""
        data = await _setup_alliance_with_bg()
        headers = create_auth_headers(user_id=str(USER_ID))

        response = await execute_post_request(
            f"/alliances/{data['alliance'].id}/defense/bg/1/import",
            payload={"placements": []},
            headers=headers,
        )
        assert response.status_code in (400, 422)

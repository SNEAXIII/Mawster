"""Integration tests for /champion-users endpoints."""
import uuid
import pytest

from main import app
from src.enums.Roles import Roles
from src.models.Champion import Champion
from src.models.ChampionUser import ChampionUser
from src.utils.db import get_session
from tests.integration.endpoints.setup.user_setup import push_one_user, get_generic_user
from tests.integration.endpoints.setup.game_setup import push_game_account
from tests.utils.utils_client import (
    create_auth_headers,
    execute_get_request,
    execute_post_request,
    execute_put_request,
    execute_delete_request,
    execute_patch_request,
)
from tests.utils.utils_constant import (
    USER_ID,
    USER2_ID,
    USER2_LOGIN,
    USER2_EMAIL,
    DISCORD_ID_2,
    GAME_PSEUDO,
    GAME_PSEUDO_2,
)
from tests.utils.utils_db import get_test_session, load_objects

app.dependency_overrides[get_session] = get_test_session

HEADERS = create_auth_headers()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _setup_user():
    await push_one_user()


async def _setup_user2():
    user2 = get_generic_user(
        login=USER2_LOGIN,
        email=USER2_EMAIL,
        role=Roles.USER,
    )
    user2.id = USER2_ID
    user2.discord_id = DISCORD_ID_2
    await load_objects([user2])


def _make_champion(
    name="Spider-Man",
    champion_class="Science",
    champion_id=None,
) -> Champion:
    return Champion(
        id=champion_id or uuid.uuid4(),
        name=name,
        champion_class=champion_class,
        is_7_star=False,
    )


async def _push_champion(name="Spider-Man", champion_class="Science") -> Champion:
    champ = _make_champion(name=name, champion_class=champion_class)
    await load_objects([champ])
    return champ


async def _push_champion_user(
    game_account_id: uuid.UUID,
    champion_id: uuid.UUID,
    rarity: str = "6r4",
    signature: int = 0,
) -> ChampionUser:
    stars = int(rarity.split("r")[0])
    rank = int(rarity.split("r")[1])
    entry = ChampionUser(
        id=uuid.uuid4(),
        game_account_id=game_account_id,
        champion_id=champion_id,
        stars=stars,
        rank=rank,
        signature=signature,
    )
    await load_objects([entry])
    return entry


# =========================================================================
# POST /champion-users (single)
# =========================================================================


class TestCreateChampionUser:
    @pytest.mark.asyncio
    async def test_create_ok(self, session):
        await _setup_user()
        acc = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        champ = await _push_champion()

        response = await execute_post_request(
            "/champion-users",
            {
                "game_account_id": str(acc.id),
                "champion_id": str(champ.id),
                "rarity": "6r4",
                "signature": 200,
            },
            headers=HEADERS,
        )
        assert response.status_code == 201
        body = response.json()
        assert body["rarity"] == "6r4"
        assert body["signature"] == 200

    @pytest.mark.asyncio
    async def test_create_without_auth_returns_401(self, session):
        response = await execute_post_request(
            "/champion-users",
            {
                "game_account_id": str(uuid.uuid4()),
                "champion_id": str(uuid.uuid4()),
                "rarity": "6r4",
            },
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_create_invalid_rarity(self, session):
        await _setup_user()
        acc = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        champ = await _push_champion()

        response = await execute_post_request(
            "/champion-users",
            {
                "game_account_id": str(acc.id),
                "champion_id": str(champ.id),
                "rarity": "invalid",
            },
            headers=HEADERS,
        )
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_create_game_account_not_found(self, session):
        await _setup_user()
        champ = await _push_champion()

        response = await execute_post_request(
            "/champion-users",
            {
                "game_account_id": str(uuid.uuid4()),
                "champion_id": str(champ.id),
                "rarity": "6r4",
            },
            headers=HEADERS,
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_create_not_own_account_returns_403(self, session):
        await _setup_user()
        await _setup_user2()
        acc = await push_game_account(user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)
        champ = await _push_champion()

        response = await execute_post_request(
            "/champion-users",
            {
                "game_account_id": str(acc.id),
                "champion_id": str(champ.id),
                "rarity": "6r4",
            },
            headers=HEADERS,
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_create_updates_existing_same_rarity(self, session):
        """Creating with same champion+rarity should update signature."""
        await _setup_user()
        acc = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        champ = await _push_champion()
        await _push_champion_user(acc.id, champ.id, "6r4")

        response = await execute_post_request(
            "/champion-users",
            {
                "game_account_id": str(acc.id),
                "champion_id": str(champ.id),
                "rarity": "6r4",
                "signature": 200,
            },
            headers=HEADERS,
        )
        assert response.status_code == 201
        body = response.json()
        assert body["signature"] == 200

    @pytest.mark.asyncio
    async def test_champion_not_found_returns_404(self, session):
        """Referencing a nonexistent champion_id -> exactly 404."""
        await _setup_user()
        acc = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        response = await execute_post_request(
            "/champion-users",
            {
                "game_account_id": str(acc.id),
                "champion_id": str(uuid.uuid4()),
                "rarity": "6r4",
                "signature": 0,
            },
            headers=HEADERS,
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "bad_rarity",
        ["invalid", "6r0", "6r6", "8r1", "5r4", "r4", "6", "", "7R5", "7r"],
        ids=["garbage", "rank_zero", "rank_six", "star_eight", "star_five",
             "no_star", "just_star", "empty", "uppercase", "no_rank_number"],
    )
    async def test_invalid_rarity_parametrized_returns_400(self, session, bad_rarity):
        """All invalid rarity strings must return exactly 400."""
        await _setup_user()
        acc = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        champ = await _push_champion()
        response = await execute_post_request(
            "/champion-users",
            {
                "game_account_id": str(acc.id),
                "champion_id": str(champ.id),
                "rarity": bad_rarity,
                "signature": 0,
            },
            headers=HEADERS,
        )
        assert response.status_code == 400, f"Expected 400 for rarity='{bad_rarity}', got {response.status_code}"

    @pytest.mark.asyncio
    async def test_response_body_structure(self, session):
        """Verify response contains all expected fields."""
        await _setup_user()
        acc = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        champ = await _push_champion()
        response = await execute_post_request(
            "/champion-users",
            {
                "game_account_id": str(acc.id),
                "champion_id": str(champ.id),
                "rarity": "7r5",
                "signature": 200,
            },
            headers=HEADERS,
        )
        assert response.status_code == 201
        body = response.json()
        assert set(body.keys()) == {"id", "game_account_id", "champion_id", "rarity", "signature"}
        assert body["rarity"] == "7r5"
        assert body["signature"] == 200
        assert body["champion_id"] == str(champ.id)
        assert body["game_account_id"] == str(acc.id)

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "rarity",
        ["6r4", "6r5", "7r1", "7r2", "7r3", "7r4", "7r5"],
        ids=["6r4", "6r5", "7r1", "7r2", "7r3", "7r4", "7r5"],
    )
    async def test_all_valid_rarities_accepted(self, session, rarity):
        """Every valid rarity must succeed with 201."""
        await _setup_user()
        acc = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        champ = await _push_champion(name=f"Champ-{rarity}")
        response = await execute_post_request(
            "/champion-users",
            {
                "game_account_id": str(acc.id),
                "champion_id": str(champ.id),
                "rarity": rarity,
                "signature": 0,
            },
            headers=HEADERS,
        )
        assert response.status_code == 201
        assert response.json()["rarity"] == rarity


# =========================================================================
# POST /champion-users/bulk
# =========================================================================


class TestBulkAddChampions:
    @pytest.mark.asyncio
    async def test_bulk_add_ok(self, session):
        await _setup_user()
        acc = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        await _push_champion("Spider-Man", "Science")
        await _push_champion("Wolverine", "Mutant")

        response = await execute_post_request(
            "/champion-users/bulk",
            {
                "game_account_id": str(acc.id),
                "champions": [
                    {"champion_name": "Spider-Man", "rarity": "6r4", "signature": 0},
                    {"champion_name": "Wolverine", "rarity": "7r3", "signature": 200},
                ],
            },
            headers=HEADERS,
        )
        assert response.status_code == 201
        body = response.json()
        assert len(body) == 2

    @pytest.mark.asyncio
    async def test_bulk_dedup_same_request(self, session):
        """Same champion+rarity in one request → only first kept."""
        await _setup_user()
        acc = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        await _push_champion()

        response = await execute_post_request(
            "/champion-users/bulk",
            {
                "game_account_id": str(acc.id),
                "champions": [
                    {"champion_name": "Spider-Man", "rarity": "6r4", "signature": 100},
                    {"champion_name": "Spider-Man", "rarity": "6r4", "signature": 999},
                ],
            },
            headers=HEADERS,
        )
        assert response.status_code == 201
        body = response.json()
        assert len(body) == 1
        assert body[0]["signature"] == 100

    @pytest.mark.asyncio
    async def test_bulk_updates_existing_db_entry(self, session):
        """If champion+rarity already in DB → update signature."""
        await _setup_user()
        acc = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        champ = await _push_champion()
        await _push_champion_user(acc.id, champ.id, "6r4")

        response = await execute_post_request(
            "/champion-users/bulk",
            {
                "game_account_id": str(acc.id),
                "champions": [
                    {"champion_name": "Spider-Man", "rarity": "6r4", "signature": 200},
                ],
            },
            headers=HEADERS,
        )
        assert response.status_code == 201
        body = response.json()
        assert len(body) == 1
        assert body[0]["signature"] == 200

    @pytest.mark.asyncio
    async def test_bulk_without_auth_returns_401(self, session):
        response = await execute_post_request(
            "/champion-users/bulk",
            {
                "game_account_id": str(uuid.uuid4()),
                "champions": [
                    {"champion_name": "Spider-Man", "rarity": "6r4"},
                ],
            },
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_bulk_not_own_account_returns_403(self, session):
        await _setup_user()
        await _setup_user2()
        acc = await push_game_account(user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)
        await _push_champion()

        response = await execute_post_request(
            "/champion-users/bulk",
            {
                "game_account_id": str(acc.id),
                "champions": [
                    {"champion_name": "Spider-Man", "rarity": "6r4"},
                ],
            },
            headers=HEADERS,
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_bulk_same_champion_different_rarities_ok(self, session):
        """Same champion with different rarities should create separate entries."""
        await _setup_user()
        acc = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        await _push_champion()

        response = await execute_post_request(
            "/champion-users/bulk",
            {
                "game_account_id": str(acc.id),
                "champions": [
                    {"champion_name": "Spider-Man", "rarity": "6r4", "signature": 0},
                    {"champion_name": "Spider-Man", "rarity": "7r3", "signature": 200},
                ],
            },
            headers=HEADERS,
        )
        assert response.status_code == 201
        body = response.json()
        assert len(body) == 2
        rarities = {e["rarity"] for e in body}
        assert rarities == {"6r4", "7r3"}

    @pytest.mark.asyncio
    async def test_bulk_champion_not_found_returns_404(self, session):
        """Referencing nonexistent champion in bulk -> 404."""
        await _setup_user()
        acc = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        response = await execute_post_request(
            "/champion-users/bulk",
            {
                "game_account_id": str(acc.id),
                "champions": [
                    {"champion_name": "NonExistentChampion", "rarity": "6r4"},
                ],
            },
            headers=HEADERS,
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_bulk_invalid_rarity_returns_400(self, session):
        await _setup_user()
        acc = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        await _push_champion()
        response = await execute_post_request(
            "/champion-users/bulk",
            {
                "game_account_id": str(acc.id),
                "champions": [
                    {"champion_name": "Spider-Man", "rarity": "invalid"},
                ],
            },
            headers=HEADERS,
        )
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_bulk_empty_champions_list_returns_400(self, session):
        """Empty champions list violates min_length=1 -> 400."""
        await _setup_user()
        acc = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        response = await execute_post_request(
            "/champion-users/bulk",
            {
                "game_account_id": str(acc.id),
                "champions": [],
            },
            headers=HEADERS,
        )
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_bulk_missing_champions_field_returns_400(self, session):
        """Missing 'champions' field -> 400."""
        await _setup_user()
        acc = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        response = await execute_post_request(
            "/champion-users/bulk",
            {"game_account_id": str(acc.id)},
            headers=HEADERS,
        )
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_bulk_game_account_not_found_returns_404(self, session):
        await _setup_user()
        await _push_champion()
        response = await execute_post_request(
            "/champion-users/bulk",
            {
                "game_account_id": str(uuid.uuid4()),
                "champions": [
                    {"champion_name": "Spider-Man", "rarity": "6r4"},
                ],
            },
            headers=HEADERS,
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_bulk_response_body_structure(self, session):
        """Verify bulk response is a list of ChampionUserResponse objects."""
        await _setup_user()
        acc = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        await _push_champion("Hulk", "Science")
        await _push_champion("Thor", "Cosmic")
        response = await execute_post_request(
            "/champion-users/bulk",
            {
                "game_account_id": str(acc.id),
                "champions": [
                    {"champion_name": "Hulk", "rarity": "6r4", "signature": 0},
                    {"champion_name": "Thor", "rarity": "7r3", "signature": 200},
                ],
            },
            headers=HEADERS,
        )
        assert response.status_code == 201
        body = response.json()
        assert isinstance(body, list)
        assert len(body) == 2
        for entry in body:
            assert set(entry.keys()) == {"id", "game_account_id", "champion_id", "rarity", "signature"}

    @pytest.mark.asyncio
    async def test_bulk_mixed_valid_and_invalid_champion_returns_404(self, session):
        """If any champion in the bulk request is invalid, the whole request should fail atomically."""
        await _setup_user()
        acc = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        await _push_champion()
        response = await execute_post_request(
            "/champion-users/bulk",
            {
                "game_account_id": str(acc.id),
                "champions": [
                    {"champion_name": "Spider-Man", "rarity": "6r4"},
                    {"champion_name": "NonExistentChampion", "rarity": "6r4"},
                ],
            },
            headers=HEADERS,
        )
        assert response.status_code == 404


# =========================================================================
# GET /champion-users/by-account/{id}
# =========================================================================


class TestGetRosterByGameAccount:
    @pytest.mark.asyncio
    async def test_get_roster_empty(self, session):
        await _setup_user()
        acc = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)

        response = await execute_get_request(
            f"/champion-users/by-account/{acc.id}", headers=HEADERS
        )
        assert response.status_code == 200
        assert response.json() == []

    @pytest.mark.asyncio
    async def test_get_roster_with_entries(self, session):
        await _setup_user()
        acc = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        champ = await _push_champion()
        await _push_champion_user(acc.id, champ.id, "6r4", signature=200)

        response = await execute_get_request(
            f"/champion-users/by-account/{acc.id}", headers=HEADERS
        )
        assert response.status_code == 200
        body = response.json()
        assert len(body) == 1
        assert body[0]["rarity"] == "6r4"
        assert body[0]["signature"] == 200
        # Should include champion details
        assert body[0]["champion_name"] == "Spider-Man"
        assert body[0]["champion_class"] == "Science"

    @pytest.mark.asyncio
    async def test_get_roster_not_own_account_403(self, session):
        await _setup_user()
        await _setup_user2()
        acc = await push_game_account(user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)

        response = await execute_get_request(
            f"/champion-users/by-account/{acc.id}", headers=HEADERS
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_get_roster_nonexistent_account_404(self, session):
        await _setup_user()
        response = await execute_get_request(
            f"/champion-users/by-account/{uuid.uuid4()}", headers=HEADERS
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_invalid_uuid_returns_400(self, session):
        await _setup_user()
        response = await execute_get_request(
            "/champion-users/by-account/not-a-uuid", headers=HEADERS
        )
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_detail_response_structure(self, session):
        """Verify the detail response includes champion name/class/image."""
        await _setup_user()
        acc = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        champ = await _push_champion("Doctor Doom", "Mystic")
        await _push_champion_user(acc.id, champ.id, "7r5", signature=200)
        response = await execute_get_request(
            f"/champion-users/by-account/{acc.id}", headers=HEADERS
        )
        assert response.status_code == 200
        body = response.json()
        assert len(body) == 1
        entry = body[0]
        expected_fields = {
            "id", "game_account_id", "champion_id", "rarity", "signature",
            "champion_name", "champion_class", "image_url",
        }
        assert expected_fields.issubset(entry.keys())
        assert entry["champion_name"] == "Doctor Doom"
        assert entry["champion_class"] == "Mystic"

    @pytest.mark.asyncio
    async def test_multiple_entries_sorted(self, session):
        """Multiple roster entries should all be returned."""
        await _setup_user()
        acc = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        c1 = await _push_champion("Spider-Man", "Science")
        c2 = await _push_champion("Wolverine", "Mutant")
        c3 = await _push_champion("Thor", "Cosmic")
        await _push_champion_user(acc.id, c1.id, "6r4")
        await _push_champion_user(acc.id, c2.id, "7r3")
        await _push_champion_user(acc.id, c3.id, "7r5")
        response = await execute_get_request(
            f"/champion-users/by-account/{acc.id}", headers=HEADERS
        )
        assert response.status_code == 200
        body = response.json()
        assert len(body) == 3


# =========================================================================
# GET /champion-users/{id}
# =========================================================================


class TestGetChampionUser:
    @pytest.mark.asyncio
    async def test_get_ok(self, session):
        await _setup_user()
        acc = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        champ = await _push_champion()
        entry = await _push_champion_user(acc.id, champ.id, "7r3", signature=200)

        response = await execute_get_request(
            f"/champion-users/{entry.id}", headers=HEADERS
        )
        assert response.status_code == 200
        body = response.json()
        assert body["rarity"] == "7r3"
        assert body["signature"] == 200

    @pytest.mark.asyncio
    async def test_get_not_found_404(self, session):
        await _setup_user()
        response = await execute_get_request(
            f"/champion-users/{uuid.uuid4()}", headers=HEADERS
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_get_not_own_champion_403(self, session):
        await _setup_user()
        await _setup_user2()
        acc = await push_game_account(user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)
        champ = await _push_champion()
        entry = await _push_champion_user(acc.id, champ.id, "6r4")

        response = await execute_get_request(
            f"/champion-users/{entry.id}", headers=HEADERS
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_get_invalid_uuid_returns_400(self, session):
        await _setup_user()
        response = await execute_get_request(
            "/champion-users/not-a-uuid", headers=HEADERS
        )
        assert response.status_code == 400


# =========================================================================
# PUT /champion-users/{id}
# =========================================================================


class TestUpdateChampionUser:
    @pytest.mark.asyncio
    async def test_update_ok(self, session):
        await _setup_user()
        acc = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        champ = await _push_champion()
        entry = await _push_champion_user(acc.id, champ.id, "6r4")

        response = await execute_put_request(
            f"/champion-users/{entry.id}",
            {
                "game_account_id": str(acc.id),
                "champion_id": str(champ.id),
                "rarity": "7r5",
                "signature": 200,
            },
            headers=HEADERS,
        )
        assert response.status_code == 200
        body = response.json()
        assert body["rarity"] == "7r5"
        assert body["signature"] == 200

    @pytest.mark.asyncio
    async def test_update_not_found_404(self, session):
        await _setup_user()
        response = await execute_put_request(
            f"/champion-users/{uuid.uuid4()}",
            {
                "game_account_id": str(uuid.uuid4()),
                "champion_id": str(uuid.uuid4()),
                "rarity": "6r4",
            },
            headers=HEADERS,
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_update_not_own_champion_403(self, session):
        await _setup_user()
        await _setup_user2()
        acc = await push_game_account(user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)
        champ = await _push_champion()
        entry = await _push_champion_user(acc.id, champ.id, "6r4")

        response = await execute_put_request(
            f"/champion-users/{entry.id}",
            {
                "game_account_id": str(acc.id),
                "champion_id": str(champ.id),
                "rarity": "7r3",
            },
            headers=HEADERS,
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_update_invalid_rarity_returns_400(self, session):
        """Updating with invalid rarity should return exactly 400."""
        await _setup_user()
        acc = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        champ = await _push_champion()
        entry = await _push_champion_user(acc.id, champ.id, "6r4")
        response = await execute_put_request(
            f"/champion-users/{entry.id}",
            {
                "game_account_id": str(acc.id),
                "champion_id": str(champ.id),
                "rarity": "invalid",
                "signature": 0,
            },
            headers=HEADERS,
        )
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_update_without_auth_returns_401(self, session):
        response = await execute_put_request(
            f"/champion-users/{uuid.uuid4()}",
            {
                "game_account_id": str(uuid.uuid4()),
                "champion_id": str(uuid.uuid4()),
                "rarity": "6r4",
            },
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_update_invalid_uuid_returns_400(self, session):
        await _setup_user()
        response = await execute_put_request(
            "/champion-users/not-a-uuid",
            {
                "game_account_id": str(uuid.uuid4()),
                "champion_id": str(uuid.uuid4()),
                "rarity": "6r4",
            },
            headers=HEADERS,
        )
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_update_response_body_matches_request(self, session):
        """After update, the response body should reflect the new values."""
        await _setup_user()
        acc = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        champ = await _push_champion()
        entry = await _push_champion_user(acc.id, champ.id, "6r4", signature=0)
        response = await execute_put_request(
            f"/champion-users/{entry.id}",
            {
                "game_account_id": str(acc.id),
                "champion_id": str(champ.id),
                "rarity": "7r5",
                "signature": 200,
            },
            headers=HEADERS,
        )
        assert response.status_code == 200
        body = response.json()
        assert body["rarity"] == "7r5"
        assert body["signature"] == 200
        assert body["id"] == str(entry.id)


# =========================================================================
# DELETE /champion-users/{id}
# =========================================================================


class TestDeleteChampionUser:
    @pytest.mark.asyncio
    async def test_delete_ok(self, session):
        await _setup_user()
        acc = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        champ = await _push_champion()
        entry = await _push_champion_user(acc.id, champ.id, "6r4")

        response = await execute_delete_request(
            f"/champion-users/{entry.id}", headers=HEADERS
        )
        assert response.status_code == 204

    @pytest.mark.asyncio
    async def test_delete_not_found_404(self, session):
        await _setup_user()
        response = await execute_delete_request(
            f"/champion-users/{uuid.uuid4()}", headers=HEADERS
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_not_own_champion_403(self, session):
        await _setup_user()
        await _setup_user2()
        acc = await push_game_account(user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)
        champ = await _push_champion()
        entry = await _push_champion_user(acc.id, champ.id, "6r4")

        response = await execute_delete_request(
            f"/champion-users/{entry.id}", headers=HEADERS
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_redelete_returns_404(self, session):
        """Deleting the same entry twice -> second should 404."""
        await _setup_user()
        acc = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        champ = await _push_champion()
        entry = await _push_champion_user(acc.id, champ.id)
        r1 = await execute_delete_request(
            f"/champion-users/{entry.id}", headers=HEADERS
        )
        assert r1.status_code == 204
        r2 = await execute_delete_request(
            f"/champion-users/{entry.id}", headers=HEADERS
        )
        assert r2.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_invalid_uuid_returns_400(self, session):
        await _setup_user()
        response = await execute_delete_request(
            "/champion-users/not-a-uuid", headers=HEADERS
        )
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_delete_without_auth_returns_401(self, session):
        response = await execute_delete_request(
            f"/champion-users/{uuid.uuid4()}"
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_delete_verifies_roster_empty_after(self, session):
        """After deleting the only entry, roster should be empty."""
        await _setup_user()
        acc = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        champ = await _push_champion()
        entry = await _push_champion_user(acc.id, champ.id)
        await execute_delete_request(
            f"/champion-users/{entry.id}", headers=HEADERS
        )
        roster_resp = await execute_get_request(
            f"/champion-users/by-account/{acc.id}", headers=HEADERS
        )
        assert roster_resp.status_code == 200
        assert roster_resp.json() == []


# =========================================================================
# PATCH /champion-users/{id}/upgrade
# =========================================================================


class TestUpgradeChampionRank:
    @pytest.mark.asyncio
    async def test_upgrade_ok(self, session):
        """7r2 → 7r3"""
        await _setup_user()
        acc = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        champ = await _push_champion()
        entry = await _push_champion_user(acc.id, champ.id, "7r2", signature=50)

        response = await execute_patch_request(
            f"/champion-users/{entry.id}/upgrade", {}, headers=HEADERS
        )
        assert response.status_code == 200
        body = response.json()
        assert body["rarity"] == "7r3"
        assert body["signature"] == 50  # signature preserved

    @pytest.mark.asyncio
    async def test_upgrade_6r4_to_6r5(self, session):
        """6r4 → 6r5"""
        await _setup_user()
        acc = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        champ = await _push_champion()
        entry = await _push_champion_user(acc.id, champ.id, "6r4")

        response = await execute_patch_request(
            f"/champion-users/{entry.id}/upgrade", {}, headers=HEADERS
        )
        assert response.status_code == 200
        assert response.json()["rarity"] == "6r5"

    @pytest.mark.asyncio
    async def test_upgrade_max_rank_returns_400(self, session):
        """7r5 is max → 400"""
        await _setup_user()
        acc = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        champ = await _push_champion()
        entry = await _push_champion_user(acc.id, champ.id, "7r5")

        response = await execute_patch_request(
            f"/champion-users/{entry.id}/upgrade", {}, headers=HEADERS
        )
        assert response.status_code == 400
        assert "maximum rank" in response.json()["message"].lower()

    @pytest.mark.asyncio
    async def test_upgrade_6r5_max_for_6_star_returns_400(self, session):
        """6r5 is max for 6-star → 400 (6r6 is not a valid rarity)"""
        await _setup_user()
        acc = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        champ = await _push_champion()
        entry = await _push_champion_user(acc.id, champ.id, "6r5")

        response = await execute_patch_request(
            f"/champion-users/{entry.id}/upgrade", {}, headers=HEADERS
        )
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_upgrade_not_found_404(self, session):
        await _setup_user()
        response = await execute_patch_request(
            f"/champion-users/{uuid.uuid4()}/upgrade", {}, headers=HEADERS
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_upgrade_not_own_champion_403(self, session):
        await _setup_user()
        await _setup_user2()
        acc = await push_game_account(user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)
        champ = await _push_champion()
        entry = await _push_champion_user(acc.id, champ.id, "7r1")

        response = await execute_patch_request(
            f"/champion-users/{entry.id}/upgrade", {}, headers=HEADERS
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_upgrade_without_auth_returns_401(self, session):
        await _setup_user()
        acc = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        champ = await _push_champion()
        entry = await _push_champion_user(acc.id, champ.id, "7r1")

        response = await execute_patch_request(
            f"/champion-users/{entry.id}/upgrade", {}
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_upgrade_preserves_champion_id(self, session):
        """Ensure upgrade only changes rank, not champion_id or game_account_id."""
        await _setup_user()
        acc = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        champ = await _push_champion()
        entry = await _push_champion_user(acc.id, champ.id, "7r1", signature=100)

        response = await execute_patch_request(
            f"/champion-users/{entry.id}/upgrade", {}, headers=HEADERS
        )
        assert response.status_code == 200
        body = response.json()
        assert body["champion_id"] == str(champ.id)
        assert body["game_account_id"] == str(acc.id)
        assert body["rarity"] == "7r2"
        assert body["signature"] == 100

    @pytest.mark.asyncio
    async def test_upgrade_invalid_uuid_returns_400(self, session):
        await _setup_user()
        response = await execute_patch_request(
            "/champion-users/not-a-uuid/upgrade", {}, headers=HEADERS
        )
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_upgrade_response_body_structure(self, session):
        """Ensure upgrade response has all expected fields."""
        await _setup_user()
        acc = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        champ = await _push_champion()
        entry = await _push_champion_user(acc.id, champ.id, "7r1")
        response = await execute_patch_request(
            f"/champion-users/{entry.id}/upgrade", {}, headers=HEADERS
        )
        assert response.status_code == 200
        body = response.json()
        assert set(body.keys()) == {"id", "game_account_id", "champion_id", "rarity", "signature"}
        assert body["id"] == str(entry.id)
        assert body["rarity"] == "7r2"

    @pytest.mark.asyncio
    @pytest.mark.parametrize("rarity", ["6r5", "7r5"])
    async def test_upgrade_all_max_rarities_return_400(self, session, rarity):
        """Both 6r5 and 7r5 are ceilings for their star level."""
        await _setup_user()
        acc = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        champ = await _push_champion()
        entry = await _push_champion_user(acc.id, champ.id, rarity)
        response = await execute_patch_request(
            f"/champion-users/{entry.id}/upgrade", {}, headers=HEADERS
        )
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_upgrade_successive_ranks(self, session):
        """Chain upgrades: 7r1 -> 7r2 -> 7r3 -> 7r4 -> 7r5 -> 400."""
        await _setup_user()
        acc = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        champ = await _push_champion()
        entry = await _push_champion_user(acc.id, champ.id, "7r1")
        expected_rarities = ["7r2", "7r3", "7r4", "7r5"]
        for expected in expected_rarities:
            r = await execute_patch_request(
                f"/champion-users/{entry.id}/upgrade", {}, headers=HEADERS
            )
            assert r.status_code == 200
            assert r.json()["rarity"] == expected
        r = await execute_patch_request(
            f"/champion-users/{entry.id}/upgrade", {}, headers=HEADERS
        )
        assert r.status_code == 400

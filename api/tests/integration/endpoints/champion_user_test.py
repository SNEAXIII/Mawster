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
)
from tests.utils.utils_constant import (
    USER_ID,
    USER_LOGIN,
    USER_EMAIL,
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


# =========================================================================
# POST /champion-users/bulk
# =========================================================================


class TestBulkAddChampions:
    @pytest.mark.asyncio
    async def test_bulk_add_ok(self, session):
        await _setup_user()
        acc = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        champ1 = await _push_champion("Spider-Man", "Science")
        champ2 = await _push_champion("Wolverine", "Mutant")

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
        champ = await _push_champion()

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
        champ = await _push_champion()

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
        champ = await _push_champion()

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

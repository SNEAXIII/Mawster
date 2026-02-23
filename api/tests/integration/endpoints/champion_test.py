"""Integration tests for /admin/champions endpoints."""
import uuid

import pytest

from main import app
from src.enums.Roles import Roles
from src.models.Champion import Champion
from src.utils.db import get_session
from tests.integration.endpoints.setup.user_setup import get_generic_user
from tests.utils.utils_client import (
    create_auth_headers,
    execute_get_request,
    execute_patch_request,
    execute_post_request,
    execute_delete_request,
)
from tests.utils.utils_constant import (
    USER_ID, USER_LOGIN, USER_EMAIL,
    ADMIN_LOGIN, ADMIN_EMAIL,
)
from tests.utils.utils_db import get_test_session, load_objects

app.dependency_overrides[get_session] = get_test_session

ADMIN_HEADERS = create_auth_headers(
    login=ADMIN_LOGIN, user_id=str(USER_ID), email=ADMIN_EMAIL, role=Roles.ADMIN
)
USER_HEADERS = create_auth_headers(
    login=USER_LOGIN, user_id=str(USER_ID), email=USER_EMAIL, role=Roles.USER
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _setup_admin():
    admin = get_generic_user(
        is_base_id=True, login=ADMIN_LOGIN, email=ADMIN_EMAIL, role=Roles.ADMIN
    )
    await load_objects([admin])


def _make_champion(
    name="Spider-Man",
    champion_class="Science",
    image_url=None,
    is_7_star=False,
    alias=None,
) -> Champion:
    return Champion(
        id=uuid.uuid4(),
        name=name,
        champion_class=champion_class,
        image_url=image_url,
        is_7_star=is_7_star,
        alias=alias,
    )


async def _setup_champions(champions: list[Champion]):
    await load_objects(champions)


# =========================================================================
# GET /admin/champions — list with pagination
# =========================================================================


class TestGetChampions:
    @pytest.mark.asyncio
    async def test_admin_can_list_champions(self, session):
        await _setup_admin()
        champs = [
            _make_champion(name="Spider-Man", champion_class="Science"),
            _make_champion(name="Wolverine", champion_class="Mutant"),
        ]
        await _setup_champions(champs)

        response = await execute_get_request(
            "/admin/champions?page=1&size=10", headers=ADMIN_HEADERS
        )
        assert response.status_code == 200
        body = response.json()
        assert body["total_champions"] == 2
        assert len(body["champions"]) == 2

    @pytest.mark.asyncio
    async def test_non_admin_cannot_list(self, session):
        response = await execute_get_request(
            "/admin/champions?page=1&size=10", headers=USER_HEADERS
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_no_auth_returns_401(self, session):
        response = await execute_get_request("/admin/champions?page=1&size=10")
        assert response.status_code == 401

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "page, size, expected_status",
        [(1, 10, 200), (0, 10, 400), (1, 0, 400)],
        ids=["valid", "page_zero", "size_zero"],
    )
    async def test_pagination_validation(self, session, page, size, expected_status):
        await _setup_admin()
        response = await execute_get_request(
            f"/admin/champions?page={page}&size={size}", headers=ADMIN_HEADERS
        )
        assert response.status_code == expected_status

    @pytest.mark.asyncio
    async def test_filter_by_class(self, session):
        await _setup_admin()
        champs = [
            _make_champion(name="Spider-Man", champion_class="Science"),
            _make_champion(name="Wolverine", champion_class="Mutant"),
            _make_champion(name="Captain America", champion_class="Science"),
        ]
        await _setup_champions(champs)

        response = await execute_get_request(
            "/admin/champions?page=1&size=10&champion_class=Science",
            headers=ADMIN_HEADERS,
        )
        assert response.status_code == 200
        body = response.json()
        assert body["total_champions"] == 2
        for c in body["champions"]:
            assert c["champion_class"] == "Science"

    @pytest.mark.asyncio
    async def test_search_by_name(self, session):
        await _setup_admin()
        champs = [
            _make_champion(name="Spider-Man", champion_class="Science"),
            _make_champion(name="Wolverine", champion_class="Mutant"),
        ]
        await _setup_champions(champs)

        response = await execute_get_request(
            "/admin/champions?page=1&size=10&search=spider",
            headers=ADMIN_HEADERS,
        )
        assert response.status_code == 200
        body = response.json()
        assert body["total_champions"] == 1
        assert body["champions"][0]["name"] == "Spider-Man"

    @pytest.mark.asyncio
    async def test_search_by_alias(self, session):
        await _setup_admin()
        champs = [
            _make_champion(name="Spider-Man", champion_class="Science", alias="spidey;peter"),
            _make_champion(name="Wolverine", champion_class="Mutant", alias="logan;james"),
        ]
        await _setup_champions(champs)

        response = await execute_get_request(
            "/admin/champions?page=1&size=10&search=logan",
            headers=ADMIN_HEADERS,
        )
        assert response.status_code == 200
        body = response.json()
        assert body["total_champions"] == 1
        assert body["champions"][0]["name"] == "Wolverine"

    @pytest.mark.asyncio
    async def test_empty_list(self, session):
        await _setup_admin()
        response = await execute_get_request(
            "/admin/champions?page=1&size=10", headers=ADMIN_HEADERS
        )
        assert response.status_code == 200
        body = response.json()
        assert body["total_champions"] == 0
        assert body["champions"] == []

    @pytest.mark.asyncio
    async def test_pagination_pages(self, session):
        await _setup_admin()
        champs = [
            _make_champion(name=f"Champion_{i:03d}", champion_class="Science")
            for i in range(15)
        ]
        await _setup_champions(champs)

        # Page 1
        response = await execute_get_request(
            "/admin/champions?page=1&size=10", headers=ADMIN_HEADERS
        )
        assert response.status_code == 200
        body = response.json()
        assert body["total_champions"] == 15
        assert body["total_pages"] == 2
        assert len(body["champions"]) == 10

        # Page 2
        response = await execute_get_request(
            "/admin/champions?page=2&size=10", headers=ADMIN_HEADERS
        )
        assert response.status_code == 200
        body = response.json()
        assert len(body["champions"]) == 5


# =========================================================================
# GET /admin/champions/{champion_id} — single champion
# =========================================================================


class TestGetChampionById:
    @pytest.mark.asyncio
    async def test_get_existing(self, session):
        await _setup_admin()
        champ = _make_champion()
        await _setup_champions([champ])

        response = await execute_get_request(
            f"/admin/champions/{champ.id}", headers=ADMIN_HEADERS
        )
        assert response.status_code == 200
        body = response.json()
        assert body["name"] == "Spider-Man"
        assert body["champion_class"] == "Science"

    @pytest.mark.asyncio
    async def test_get_nonexistent(self, session):
        await _setup_admin()
        response = await execute_get_request(
            f"/admin/champions/{uuid.uuid4()}", headers=ADMIN_HEADERS
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_non_admin_cannot_get(self, session):
        response = await execute_get_request(
            f"/admin/champions/{uuid.uuid4()}", headers=USER_HEADERS
        )
        assert response.status_code == 403


# =========================================================================
# PATCH /admin/champions/{champion_id}/alias — update alias
# =========================================================================


class TestUpdateAlias:
    @pytest.mark.asyncio
    async def test_update_alias(self, session):
        await _setup_admin()
        champ = _make_champion()
        await _setup_champions([champ])

        response = await execute_patch_request(
            f"/admin/champions/{champ.id}/alias",
            payload={"alias": "spidey;peter"},
            headers=ADMIN_HEADERS,
        )
        assert response.status_code == 200

        # Verify alias was saved
        get_resp = await execute_get_request(
            f"/admin/champions/{champ.id}", headers=ADMIN_HEADERS
        )
        assert get_resp.json()["alias"] == "spidey;peter"

    @pytest.mark.asyncio
    async def test_clear_alias(self, session):
        await _setup_admin()
        champ = _make_champion(alias="old_alias")
        await _setup_champions([champ])

        response = await execute_patch_request(
            f"/admin/champions/{champ.id}/alias",
            payload={"alias": None},
            headers=ADMIN_HEADERS,
        )
        assert response.status_code == 200

        get_resp = await execute_get_request(
            f"/admin/champions/{champ.id}", headers=ADMIN_HEADERS
        )
        assert get_resp.json()["alias"] is None

    @pytest.mark.asyncio
    async def test_update_alias_nonexistent_champion(self, session):
        await _setup_admin()
        response = await execute_patch_request(
            f"/admin/champions/{uuid.uuid4()}/alias",
            payload={"alias": "test"},
            headers=ADMIN_HEADERS,
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_non_admin_cannot_update_alias(self, session):
        response = await execute_patch_request(
            f"/admin/champions/{uuid.uuid4()}/alias",
            payload={"alias": "test"},
            headers=USER_HEADERS,
        )
        assert response.status_code == 403


# =========================================================================
# POST /admin/champions/load — bulk load
# =========================================================================


class TestLoadChampions:
    @pytest.mark.asyncio
    async def test_load_new_champions(self, session):
        await _setup_admin()

        payload = [
            {"name": "Spider-Man", "champion_class": "Science", "image_filename": "spider_man.png"},
            {"name": "Wolverine", "champion_class": "Mutant", "image_filename": "wolverine.png"},
        ]

        response = await execute_post_request(
            "/admin/champions/load", payload=payload, headers=ADMIN_HEADERS
        )
        assert response.status_code == 200
        body = response.json()
        assert body["created"] == 2
        assert body["updated"] == 0
        assert body["skipped"] == 0

    @pytest.mark.asyncio
    async def test_load_updates_existing(self, session):
        await _setup_admin()
        existing = _make_champion(name="Spider-Man", champion_class="Science")
        await _setup_champions([existing])

        payload = [
            {"name": "Spider-Man", "champion_class": "Science", "image_filename": "new_spider.png"},
        ]

        response = await execute_post_request(
            "/admin/champions/load", payload=payload, headers=ADMIN_HEADERS
        )
        assert response.status_code == 200
        body = response.json()
        assert body["created"] == 0
        assert body["updated"] == 1

    @pytest.mark.asyncio
    async def test_load_skips_invalid_class(self, session):
        await _setup_admin()

        payload = [
            {"name": "FakeChamp", "champion_class": "InvalidClass", "image_filename": "fake.png"},
        ]

        response = await execute_post_request(
            "/admin/champions/load", payload=payload, headers=ADMIN_HEADERS
        )
        assert response.status_code == 200
        body = response.json()
        assert body["skipped"] == 1
        assert body["created"] == 0

    @pytest.mark.asyncio
    async def test_non_admin_cannot_load(self, session):
        payload = [
            {"name": "Spider-Man", "champion_class": "Science", "image_filename": "s.png"},
        ]
        response = await execute_post_request(
            "/admin/champions/load", payload=payload, headers=USER_HEADERS
        )
        assert response.status_code == 403


# =========================================================================
# DELETE /admin/champions/{champion_id}
# =========================================================================


class TestDeleteChampion:
    @pytest.mark.asyncio
    async def test_delete_champion(self, session):
        await _setup_admin()
        champ = _make_champion()
        await _setup_champions([champ])

        response = await execute_delete_request(
            f"/admin/champions/{champ.id}", headers=ADMIN_HEADERS
        )
        assert response.status_code == 200

        # Verify deleted
        get_resp = await execute_get_request(
            f"/admin/champions/{champ.id}", headers=ADMIN_HEADERS
        )
        assert get_resp.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_nonexistent(self, session):
        await _setup_admin()
        response = await execute_delete_request(
            f"/admin/champions/{uuid.uuid4()}", headers=ADMIN_HEADERS
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_non_admin_cannot_delete(self, session):
        response = await execute_delete_request(
            f"/admin/champions/{uuid.uuid4()}", headers=USER_HEADERS
        )
        assert response.status_code == 403

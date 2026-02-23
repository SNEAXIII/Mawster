"""Hardened integration tests for /admin/champions endpoints.

Strict status code validation, edge cases, and response structure checks.
"""
import uuid
import pytest

from src.enums.Roles import Roles
from src.models.Champion import Champion
from main import app
from src.utils.db import get_session
from tests.integration.endpoints.setup.user_setup import push_one_user, push_one_admin
from tests.utils.utils_client import (
    create_auth_headers,
    execute_get_request,
    execute_post_request,
    execute_patch_request,
    execute_delete_request,
)
from tests.utils.utils_constant import USER_ID
from tests.utils.utils_db import get_test_session, load_objects

app.dependency_overrides[get_session] = get_test_session

USER_HEADERS = create_auth_headers(role=Roles.USER)
ADMIN_HEADERS = create_auth_headers(role=Roles.ADMIN)


async def _setup_admin():
    await push_one_admin()


async def _setup_user():
    await push_one_user()


async def _push_champion(name="Spider-Man", champion_class="Science") -> Champion:
    champ = Champion(
        id=uuid.uuid4(), name=name, champion_class=champion_class, is_7_star=False
    )
    await load_objects([champ])
    return champ


# =========================================================================
# GET /admin/champions — auth & pagination
# =========================================================================


class TestGetChampionsHardened:
    @pytest.mark.asyncio
    async def test_no_auth_returns_403(self, session):
        response = await execute_get_request("/admin/champions")
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_user_role_returns_403(self, session):
        """Non-admin users must be rejected with exactly 403."""
        await _setup_user()
        response = await execute_get_request("/admin/champions", headers=USER_HEADERS)
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_admin_can_list(self, session):
        await _setup_admin()
        response = await execute_get_request("/admin/champions", headers=ADMIN_HEADERS)
        assert response.status_code == 200
        body = response.json()
        assert "champions" in body
        assert "total_champions" in body
        assert "total_pages" in body
        assert "current_page" in body

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "params,expected_code",
        [
            ("?page=0", 400),
            ("?page=-1", 400),
            ("?size=0", 400),
            ("?size=-5", 400),
        ],
        ids=["page_zero", "page_negative", "size_zero", "size_negative"],
    )
    async def test_pagination_validation(self, session, params, expected_code):
        await _setup_admin()
        response = await execute_get_request(
            f"/admin/champions{params}", headers=ADMIN_HEADERS
        )
        assert response.status_code == expected_code

    @pytest.mark.asyncio
    async def test_filter_by_class(self, session):
        await _setup_admin()
        await _push_champion("Hulk", "Science")
        await _push_champion("Thor", "Cosmic")

        response = await execute_get_request(
            "/admin/champions?champion_class=Science", headers=ADMIN_HEADERS
        )
        assert response.status_code == 200
        body = response.json()
        for champ in body["champions"]:
            assert champ["champion_class"] == "Science"

    @pytest.mark.asyncio
    async def test_search_by_name(self, session):
        await _setup_admin()
        await _push_champion("Spider-Man", "Science")
        await _push_champion("Thor", "Cosmic")

        response = await execute_get_request(
            "/admin/champions?search=spider", headers=ADMIN_HEADERS
        )
        assert response.status_code == 200
        body = response.json()
        assert body["total_champions"] >= 1
        for champ in body["champions"]:
            assert "spider" in champ["name"].lower() or (
                champ.get("alias") and "spider" in champ["alias"].lower()
            )

    @pytest.mark.asyncio
    async def test_empty_list(self, session):
        await _setup_admin()
        response = await execute_get_request("/admin/champions", headers=ADMIN_HEADERS)
        assert response.status_code == 200
        body = response.json()
        assert body["champions"] == []
        assert body["total_champions"] == 0

    @pytest.mark.asyncio
    async def test_pagination_pages(self, session):
        """With 3 champions and size=2, there should be 2 pages."""
        await _setup_admin()
        await _push_champion("A", "Science")
        await _push_champion("B", "Cosmic")
        await _push_champion("C", "Mutant")

        response = await execute_get_request(
            "/admin/champions?page=1&size=2", headers=ADMIN_HEADERS
        )
        assert response.status_code == 200
        body = response.json()
        assert body["total_pages"] == 2
        assert len(body["champions"]) == 2

        response2 = await execute_get_request(
            "/admin/champions?page=2&size=2", headers=ADMIN_HEADERS
        )
        assert response2.status_code == 200
        body2 = response2.json()
        assert len(body2["champions"]) == 1


# =========================================================================
# GET /admin/champions/{id}
# =========================================================================


class TestGetChampionByIdHardened:
    @pytest.mark.asyncio
    async def test_nonexistent_returns_404(self, session):
        await _setup_admin()
        response = await execute_get_request(
            f"/admin/champions/{uuid.uuid4()}", headers=ADMIN_HEADERS
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_invalid_uuid_returns_422(self, session):
        await _setup_admin()
        response = await execute_get_request(
            "/admin/champions/not-a-uuid", headers=ADMIN_HEADERS
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_user_role_returns_403(self, session):
        await _setup_user()
        response = await execute_get_request(
            f"/admin/champions/{uuid.uuid4()}", headers=USER_HEADERS
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_response_body_structure(self, session):
        await _setup_admin()
        champ = await _push_champion("Hulk", "Science")
        response = await execute_get_request(
            f"/admin/champions/{champ.id}", headers=ADMIN_HEADERS
        )
        assert response.status_code == 200
        body = response.json()
        expected = {"id", "name", "champion_class", "image_url", "is_7_star", "alias"}
        assert expected.issubset(body.keys())
        assert body["name"] == "Hulk"
        assert body["champion_class"] == "Science"


# =========================================================================
# PATCH /admin/champions/{id}/alias
# =========================================================================


class TestUpdateAliasHardened:
    @pytest.mark.asyncio
    async def test_set_alias(self, session):
        await _setup_admin()
        champ = await _push_champion()
        response = await execute_patch_request(
            f"/admin/champions/{champ.id}/alias",
            {"alias": "spidey;peter"},
            headers=ADMIN_HEADERS,
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_clear_alias(self, session):
        await _setup_admin()
        champ = await _push_champion()
        response = await execute_patch_request(
            f"/admin/champions/{champ.id}/alias",
            {"alias": None},
            headers=ADMIN_HEADERS,
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_nonexistent_champion_returns_404(self, session):
        await _setup_admin()
        response = await execute_patch_request(
            f"/admin/champions/{uuid.uuid4()}/alias",
            {"alias": "test"},
            headers=ADMIN_HEADERS,
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_user_role_returns_403(self, session):
        await _setup_user()
        response = await execute_patch_request(
            f"/admin/champions/{uuid.uuid4()}/alias",
            {"alias": "test"},
            headers=USER_HEADERS,
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_alias_too_long_returns_422(self, session):
        """alias has max_length=500 in DTO."""
        await _setup_admin()
        champ = await _push_champion()
        response = await execute_patch_request(
            f"/admin/champions/{champ.id}/alias",
            {"alias": "x" * 501},
            headers=ADMIN_HEADERS,
        )
        assert response.status_code == 422


# =========================================================================
# POST /admin/champions/load
# =========================================================================


class TestLoadChampionsHardened:
    @pytest.mark.asyncio
    async def test_load_new_champions(self, session):
        await _setup_admin()
        response = await execute_post_request(
            "/admin/champions/load",
            [
                {"name": "Hulk", "champion_class": "Science"},
                {"name": "Thor", "champion_class": "Cosmic"},
            ],
            headers=ADMIN_HEADERS,
        )
        assert response.status_code == 200
        body = response.json()
        assert body["created"] == 2
        assert body["updated"] == 0
        assert body["skipped"] == 0

    @pytest.mark.asyncio
    async def test_load_updates_existing(self, session):
        await _setup_admin()
        await _push_champion("Hulk", "Science")
        response = await execute_post_request(
            "/admin/champions/load",
            [{"name": "Hulk", "champion_class": "Science"}],
            headers=ADMIN_HEADERS,
        )
        assert response.status_code == 200
        body = response.json()
        assert body["updated"] >= 1

    @pytest.mark.asyncio
    async def test_load_skips_invalid_class(self, session):
        await _setup_admin()
        response = await execute_post_request(
            "/admin/champions/load",
            [{"name": "FakeHero", "champion_class": "InvalidClass"}],
            headers=ADMIN_HEADERS,
        )
        assert response.status_code == 200
        body = response.json()
        assert body["skipped"] == 1
        assert body["created"] == 0

    @pytest.mark.asyncio
    async def test_load_user_role_returns_403(self, session):
        await _setup_user()
        response = await execute_post_request(
            "/admin/champions/load",
            [{"name": "X", "champion_class": "Science"}],
            headers=USER_HEADERS,
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_load_no_auth_returns_403(self, session):
        response = await execute_post_request(
            "/admin/champions/load",
            [{"name": "X", "champion_class": "Science"}],
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_load_empty_list(self, session):
        await _setup_admin()
        response = await execute_post_request(
            "/admin/champions/load", [], headers=ADMIN_HEADERS
        )
        assert response.status_code == 200
        body = response.json()
        assert body["created"] == 0


# =========================================================================
# DELETE /admin/champions/{id}
# =========================================================================


class TestDeleteChampionHardened:
    @pytest.mark.asyncio
    async def test_delete_ok(self, session):
        await _setup_admin()
        champ = await _push_champion()
        response = await execute_delete_request(
            f"/admin/champions/{champ.id}", headers=ADMIN_HEADERS
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_delete_nonexistent_returns_404(self, session):
        await _setup_admin()
        response = await execute_delete_request(
            f"/admin/champions/{uuid.uuid4()}", headers=ADMIN_HEADERS
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_invalid_uuid_returns_422(self, session):
        await _setup_admin()
        response = await execute_delete_request(
            "/admin/champions/not-a-uuid", headers=ADMIN_HEADERS
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_delete_user_role_returns_403(self, session):
        await _setup_user()
        response = await execute_delete_request(
            f"/admin/champions/{uuid.uuid4()}", headers=USER_HEADERS
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_delete_no_auth_returns_403(self, session):
        response = await execute_delete_request(
            f"/admin/champions/{uuid.uuid4()}"
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_redelete_returns_404(self, session):
        """Deleting the same champion twice → 404."""
        await _setup_admin()
        champ = await _push_champion()
        r1 = await execute_delete_request(
            f"/admin/champions/{champ.id}", headers=ADMIN_HEADERS
        )
        assert r1.status_code == 200
        r2 = await execute_delete_request(
            f"/admin/champions/{champ.id}", headers=ADMIN_HEADERS
        )
        assert r2.status_code == 404

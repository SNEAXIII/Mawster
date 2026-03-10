"""Integration tests for champion endpoints.

/champions (GET) — accessible to any authenticated user.
/admin/champions (PATCH, POST, DELETE) — admin only.
"""
import uuid

import pytest

from main import app
from src.enums.Roles import Roles
from src.utils.db import get_session
from tests.integration.endpoints.setup.user_setup import push_one_admin, push_one_user
from tests.integration.endpoints.setup.game_setup import get_champion, push_champion
from tests.utils.utils_client import (
    create_auth_headers,
    execute_delete_request,
    execute_get_request,
    execute_patch_request,
    execute_post_request,
    execute_request,
)
from tests.utils.utils_constant import (
    USER_ID,
)
from tests.utils.utils_db import get_test_session, load_objects

app.dependency_overrides[get_session] = get_test_session

ADMIN_HEADERS = create_auth_headers(
    user_id=str(USER_ID), role=Roles.ADMIN
)
USER_HEADERS = create_auth_headers(
    user_id=str(USER_ID), role=Roles.USER
)

CHAMPIONS_LIST_URL = "/champions?page=1&size=10"
LOAD_CHAMPIONS_URL = "/admin/champions/load"
SPIDEY_ALIAS = "spidey;peter"


# =========================================================================
# Access control — /champions (GET) requires auth but NOT admin
# =========================================================================

_FAKE_ID = str(uuid.uuid4())

_USER_CHAMPION_ROUTES = [
    ("GET", CHAMPIONS_LIST_URL, None, "list"),
    ("GET", f"/champions/{_FAKE_ID}", None, "get_by_id"),
]

_ADMIN_CHAMPION_ROUTES = [
    ("PATCH", f"/admin/champions/{_FAKE_ID}/alias", {"alias": "x"}, "update_alias"),
    ("POST", LOAD_CHAMPIONS_URL, [{"name": "X", "champion_class": "Science"}], "load"),
    ("DELETE", f"/admin/champions/{_FAKE_ID}", None, "delete"),
]


class TestChampionReadAccessControl:
    """GET /champions endpoints require authentication."""

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "method, url, payload",
        [(action, route, payload) for action, route, payload, _ in _USER_CHAMPION_ROUTES],
        ids=[name for _, _, _, name in _USER_CHAMPION_ROUTES],
    )
    async def test_no_auth_returns_401(self, session, method, url, payload):
        response = await execute_request(method, url, payload)
        assert response.status_code == 401

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "method, url, payload",
        [(action, route, payload) for action, route, payload, _ in _USER_CHAMPION_ROUTES],
        ids=[name for _, _, _, name in _USER_CHAMPION_ROUTES],
    )
    async def test_regular_user_can_access(self, session, method, url, payload):
        await push_one_user()
        response = await execute_request(method, url, payload, headers=USER_HEADERS)

        assert response.status_code not in (401, 403)


class TestAdminChampionsAccessControl:
    """Write /admin/champions endpoints require authentication and admin role."""

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "method, url, payload",
        [(action, route, payload) for action, route, payload, _ in _ADMIN_CHAMPION_ROUTES],
        ids=[name for _, _, _, name in _ADMIN_CHAMPION_ROUTES],
    )
    async def test_no_auth_returns_401(self, session, method, url, payload):
        response = await execute_request(method, url, payload)
        assert response.status_code == 401

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "method, url, payload",
        [(action, route, payload) for action, route, payload, _ in _ADMIN_CHAMPION_ROUTES],
        ids=[name for _, _, _, name in _ADMIN_CHAMPION_ROUTES],
    )
    async def test_non_admin_returns_403(self, session, method, url, payload):
        response = await execute_request(method, url, payload, headers=USER_HEADERS)
        assert response.status_code == 403


# =========================================================================
# GET /champions — list with pagination
# =========================================================================


class TestGetChampions:
    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "params, expected_status",
        [
            ("?page=1&size=10", 200),
            ("?page=0", 400),
            ("?page=-1", 400),
            ("?size=0", 400),
            ("?size=-5", 400),
        ],
        ids=["valid", "page_zero", "page_negative", "size_zero", "size_negative"],
    )
    async def test_pagination_validation(self, session, params, expected_status):
        await push_one_user()
        response = await execute_get_request(
            f"/champions{params}", headers=USER_HEADERS
        )
        assert response.status_code == expected_status

    @pytest.mark.asyncio
    async def test_user_can_list_champions(self):
        await push_one_user()
        champs = [
            get_champion(name="Spider-Man", champion_class="Science"),
            get_champion(name="Wolverine", champion_class="Mutant"),
        ]
        await load_objects(champs)

        response = await execute_get_request(
            CHAMPIONS_LIST_URL, headers=USER_HEADERS
        )
        assert response.status_code == 200
        body = response.json()
        assert body["total_champions"] == 2
        assert len(body["champions"]) == 2

    @pytest.mark.asyncio
    async def test_filter_by_class(self):
        await push_one_user()
        champs = [
            get_champion(name="Spider-Man", champion_class="Science"),
            get_champion(name="Wolverine", champion_class="Mutant"),
            get_champion(name="Captain America", champion_class="Science"),
        ]
        await load_objects(champs)

        response = await execute_get_request(
            "/champions?page=1&size=10&champion_class=Science",
            headers=USER_HEADERS,
        )
        assert response.status_code == 200
        body = response.json()
        assert body["total_champions"] == 2
        for c in body["champions"]:
            assert c["champion_class"] == "Science"

    @pytest.mark.asyncio
    async def test_search_by_name(self):
        await push_one_user()
        champs = [
            get_champion(name="Spider-Man", champion_class="Science"),
            get_champion(name="Wolverine", champion_class="Mutant"),
        ]
        await load_objects(champs)

        response = await execute_get_request(
            "/champions?page=1&size=10&search=spider",
            headers=USER_HEADERS,
        )
        assert response.status_code == 200
        body = response.json()
        assert body["total_champions"] == 1
        assert body["champions"][0]["name"] == "Spider-Man"

    @pytest.mark.asyncio
    async def test_search_by_alias(self):
        await push_one_user()
        champs = [
            get_champion(name="Spider-Man", champion_class="Science", alias=SPIDEY_ALIAS),
            get_champion(name="Wolverine", champion_class="Mutant", alias="logan;james"),
        ]
        await load_objects(champs)

        response = await execute_get_request(
            "/champions?page=1&size=10&search=logan",
            headers=USER_HEADERS,
        )
        assert response.status_code == 200
        body = response.json()
        assert body["total_champions"] == 1
        assert body["champions"][0]["name"] == "Wolverine"

    @pytest.mark.asyncio
    async def test_empty_list(self):
        await push_one_user()
        response = await execute_get_request(
            CHAMPIONS_LIST_URL, headers=USER_HEADERS
        )
        assert response.status_code == 200
        body = response.json()
        assert body["total_champions"] == 0
        assert body["champions"] == []

    @pytest.mark.asyncio
    async def test_pagination_pages(self):
        await push_one_user()
        champs = [
            get_champion(name=f"Champion_{i:03d}", champion_class="Science")
            for i in range(15)
        ]
        await load_objects(champs)

        # Page 1
        response = await execute_get_request(
            CHAMPIONS_LIST_URL, headers=USER_HEADERS
        )
        assert response.status_code == 200
        body = response.json()
        assert body["total_champions"] == 15
        assert body["total_pages"] == 2
        assert len(body["champions"]) == 10

        # Page 2
        response = await execute_get_request(
            "/champions?page=2&size=10", headers=USER_HEADERS
        )
        assert response.status_code == 200
        body = response.json()
        assert len(body["champions"]) == 5


# =========================================================================
# GET /champions/{champion_id} — single champion
# =========================================================================


class TestGetChampionById:
    @pytest.mark.asyncio
    async def test_get_existing(self):
        await push_one_user()
        champ = get_champion()
        await load_objects([champ])

        response = await execute_get_request(
            f"/champions/{champ.id}", headers=USER_HEADERS
        )
        assert response.status_code == 200
        body = response.json()
        assert body["name"] == "Spider-Man"
        assert body["champion_class"] == "Science"

    @pytest.mark.asyncio
    async def test_get_nonexistent(self):
        await push_one_user()
        response = await execute_get_request(
            f"/champions/{uuid.uuid4()}", headers=USER_HEADERS
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_invalid_uuid_returns_400(self):
        await push_one_user()
        response = await execute_get_request(
            "/champions/not-a-uuid", headers=USER_HEADERS
        )
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_response_body_structure(self):
        await push_one_user()
        champ = await push_champion("Hulk", "Science")
        response = await execute_get_request(
            f"/champions/{champ.id}", headers=USER_HEADERS
        )
        assert response.status_code == 200
        body = response.json()
        expected = {"id", "name", "champion_class", "image_url", "is_7_star", "is_ascendable", "alias"}
        assert expected.issubset(body.keys())
        assert body["name"] == "Hulk"
        assert body["champion_class"] == "Science"


# =========================================================================
# PATCH /admin/champions/{champion_id}/alias — update alias
# =========================================================================


class TestUpdateAlias:
    @pytest.mark.asyncio
    async def test_update_alias(self):
        await push_one_admin()
        champ = get_champion()
        await load_objects([champ])

        response = await execute_patch_request(
            f"/admin/champions/{champ.id}/alias",
            payload={"alias": SPIDEY_ALIAS},
            headers=ADMIN_HEADERS,
        )
        assert response.status_code == 200

        get_resp = await execute_get_request(
            f"/champions/{champ.id}", headers=ADMIN_HEADERS
        )
        assert get_resp.json()["alias"] == SPIDEY_ALIAS

    @pytest.mark.asyncio
    async def test_clear_alias(self):
        await push_one_admin()
        champ = get_champion(alias="old_alias")
        await load_objects([champ])

        response = await execute_patch_request(
            f"/admin/champions/{champ.id}/alias",
            payload={"alias": None},
            headers=ADMIN_HEADERS,
        )
        assert response.status_code == 200

        get_resp = await execute_get_request(
            f"/champions/{champ.id}", headers=ADMIN_HEADERS
        )
        assert get_resp.json()["alias"] is None

    @pytest.mark.asyncio
    async def test_update_alias_nonexistent_champion(self):
        await push_one_admin()
        response = await execute_patch_request(
            f"/admin/champions/{uuid.uuid4()}/alias",
            payload={"alias": "test"},
            headers=ADMIN_HEADERS,
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_alias_too_long_returns_400(self):
        """alias has max_length=500 in DTO."""
        await push_one_admin()
        champ = await push_champion()
        response = await execute_patch_request(
            f"/admin/champions/{champ.id}/alias",
            payload={"alias": "x" * 501},
            headers=ADMIN_HEADERS,
        )
        assert response.status_code == 400


# =========================================================================
# POST /admin/champions/load — bulk load
# =========================================================================


class TestLoadChampions:
    @pytest.mark.asyncio
    async def test_load_new_champions(self):
        await push_one_admin()

        payload = [
            {"name": "Spider-Man", "champion_class": "Science", "image_url": "spider_man.png"},
            {"name": "Wolverine", "champion_class": "Mutant", "image_url": "wolverine.png"},
        ]

        response = await execute_post_request(
            LOAD_CHAMPIONS_URL, payload=payload, headers=ADMIN_HEADERS
        )
        assert response.status_code == 200
        body = response.json()
        assert body["created"] == 2
        assert body["updated"] == 0
        assert body["skipped"] == 0

    @pytest.mark.asyncio
    async def test_load_updates_existing(self):
        await push_one_admin()
        existing = get_champion(name="Spider-Man", champion_class="Science")
        await load_objects([existing])

        payload = [
            {"name": "Spider-Man", "champion_class": "Science", "image_url": "new_spider.png"},
        ]

        response = await execute_post_request(
            LOAD_CHAMPIONS_URL, payload=payload, headers=ADMIN_HEADERS
        )
        assert response.status_code == 200
        body = response.json()
        assert body["created"] == 0
        assert body["updated"] == 1

    @pytest.mark.asyncio
    async def test_load_skips_invalid_class(self):
        await push_one_admin()

        payload = [
            {"name": "FakeChamp", "champion_class": "InvalidClass", "image_url": "fake.png"},
        ]

        response = await execute_post_request(
            LOAD_CHAMPIONS_URL, payload=payload, headers=ADMIN_HEADERS
        )
        assert response.status_code == 200
        body = response.json()
        assert body["skipped"] == 1
        assert body["created"] == 0

    @pytest.mark.asyncio
    async def test_load_empty_list(self):
        await push_one_admin()
        response = await execute_post_request(
            LOAD_CHAMPIONS_URL, payload=[], headers=ADMIN_HEADERS
        )
        assert response.status_code == 200
        body = response.json()
        assert body["created"] == 0

    @pytest.mark.asyncio
    async def test_load_with_is_ascendable(self):
        """Loading a champion with is_ascendable=True should persist the flag."""
        await push_one_admin()

        payload = [
            {"name": "Hercules", "champion_class": "Cosmic", "image_url": "herc.png", "is_ascendable": True},
        ]

        response = await execute_post_request(
            LOAD_CHAMPIONS_URL, payload=payload, headers=ADMIN_HEADERS
        )
        assert response.status_code == 200
        body = response.json()
        assert body["created"] == 1

        # Verify the flag is persisted
        get_resp = await execute_get_request(
            "/champions?page=1&size=10&search=Hercules",
            headers=ADMIN_HEADERS,
        )
        assert get_resp.status_code == 200
        champions = get_resp.json()["champions"]
        assert len(champions) == 1
        assert champions[0]["is_ascendable"] is True


# =========================================================================
# DELETE /admin/champions/{champion_id}
# =========================================================================


class TestDeleteChampion:
    @pytest.mark.asyncio
    async def test_delete_champion(self):
        await push_one_admin()
        champ = get_champion()
        await load_objects([champ])

        response = await execute_delete_request(
            f"/admin/champions/{champ.id}", headers=ADMIN_HEADERS
        )
        assert response.status_code == 200

        get_resp = await execute_get_request(
            f"/champions/{champ.id}", headers=ADMIN_HEADERS
        )
        assert get_resp.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_nonexistent(self):
        await push_one_admin()
        response = await execute_delete_request(
            f"/admin/champions/{uuid.uuid4()}", headers=ADMIN_HEADERS
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_invalid_uuid_returns_400(self):
        await push_one_admin()
        response = await execute_delete_request(
            "/admin/champions/not-a-uuid", headers=ADMIN_HEADERS
        )
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_redelete_returns_404(self):
        """Deleting the same champion twice -> 404."""
        await push_one_admin()
        champ = await push_champion()
        r1 = await execute_delete_request(
            f"/admin/champions/{champ.id}", headers=ADMIN_HEADERS
        )
        assert r1.status_code == 200
        r2 = await execute_delete_request(
            f"/admin/champions/{champ.id}", headers=ADMIN_HEADERS
        )
        assert r2.status_code == 404

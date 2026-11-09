import uuid
from datetime import timedelta

import pytest

from main import app
from src.enums.Roles import Roles
from src.models.Base import utcnow
from src.models.champion.AscensionRequest import AscensionRequest
from src.models.champion.Champion import Champion
from src.utils.db import get_session
from tests.integration.endpoints.setup.game_setup import (
    get_ascension_requests,
    push_ascension_request,
    push_champion,
)
from tests.integration.endpoints.setup.user_setup import (
    push_one_admin,
    push_one_user,
    push_user2,
)
from tests.utils.utils_client import (
    create_auth_headers,
    execute_delete_request,
    execute_get_request,
    execute_patch_request,
    execute_post_request,
    execute_request,
)
from tests.utils.utils_constant import USER2_ID, USER2_LOGIN, USER_ID
from tests.utils.utils_db import get_test_session

app.dependency_overrides[get_session] = get_test_session

ROUTE = "/admin/ascension-requests"
ADMIN_HEADERS = create_auth_headers(user_id=str(USER_ID), role=Roles.ADMIN)
USER_HEADERS = create_auth_headers(user_id=str(USER_ID), role=Roles.USER)
UNKNOWN_ID = uuid.uuid4()


async def _pending(
    name: str = "Hercules", is_ascendable: bool = False
) -> tuple[Champion, AscensionRequest]:
    champion = await push_champion(name, "Cosmic", is_ascendable=is_ascendable)
    return champion, await push_ascension_request(champion)


async def _is_ascendable(champion: Champion) -> bool:
    response = await execute_get_request(f"/champions/{champion.id}", headers=ADMIN_HEADERS)
    return response.json()["is_ascendable"]


async def _requested_champion_ids(session) -> list[uuid.UUID]:
    return [r.champion_id for r in await get_ascension_requests(session)]


async def _toggle(champion: Champion) -> bool:
    response = await execute_patch_request(
        f"/admin/champions/{champion.id}/ascendable", payload=None, headers=ADMIN_HEADERS
    )
    return response.json()["is_ascendable"]


class TestAdminAccess:
    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        ("method", "url"),
        [
            ("GET", ROUTE),
            ("POST", f"{ROUTE}/{UNKNOWN_ID}/accept"),
            ("DELETE", f"{ROUTE}/{UNKNOWN_ID}"),
        ],
        ids=["list", "accept", "refuse"],
    )
    async def test_non_admin_is_forbidden(self, session, method, url):
        await push_one_user()

        response = await execute_request(method, url, headers=USER_HEADERS)

        assert response.status_code == 403


class TestListPending:
    @pytest.mark.asyncio
    async def test_returns_pending_oldest_first(self, session):
        await push_one_admin()
        await push_user2()
        newest = await push_champion("Wolverine", "Mutant")
        oldest = await push_champion("Hercules", "Cosmic", image_url="hercules.png")
        await push_ascension_request(newest)
        created_at = utcnow() - timedelta(days=1)
        request = await push_ascension_request(oldest, USER2_ID, created_at=created_at)

        response = await execute_get_request(ROUTE, headers=ADMIN_HEADERS)

        assert response.status_code == 200
        body = response.json()
        assert [row["champion_name"] for row in body] == ["Hercules", "Wolverine"]
        assert body[0]["id"] == str(request.id)
        assert body[0]["champion_id"] == str(oldest.id)
        assert body[0]["image_url"] == "hercules.png"
        assert body[0]["requester_login"] == USER2_LOGIN
        assert body[0]["created_at"]


class TestAccept:
    @pytest.mark.asyncio
    @pytest.mark.parametrize("is_ascendable", [False, True], ids=["new", "already_ascendable"])
    async def test_makes_ascendable_and_removes_request(self, session, is_ascendable):
        await push_one_admin()
        champion, request = await _pending(is_ascendable=is_ascendable)

        response = await execute_post_request(
            f"{ROUTE}/{request.id}/accept", payload=None, headers=ADMIN_HEADERS
        )

        assert response.status_code == 204
        assert await _is_ascendable(champion) is True
        assert await get_ascension_requests(session) == []


class TestRefuse:
    @pytest.mark.asyncio
    async def test_removes_request_and_leaves_flag_false(self, session):
        await push_one_admin()
        champion, request = await _pending()

        response = await execute_delete_request(f"{ROUTE}/{request.id}", headers=ADMIN_HEADERS)

        assert response.status_code == 204
        assert await _is_ascendable(champion) is False
        assert await get_ascension_requests(session) == []


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("method", "url"),
    [("POST", f"{ROUTE}/{UNKNOWN_ID}/accept"), ("DELETE", f"{ROUTE}/{UNKNOWN_ID}")],
    ids=["accept", "refuse"],
)
async def test_unknown_request_is_404(session, method, url):
    await push_one_admin()

    response = await execute_request(method, url, headers=ADMIN_HEADERS)

    assert response.status_code == 404


class TestRequestsResolvedElsewhere:
    @pytest.mark.asyncio
    async def test_toggle_to_true_removes_only_that_request(self, session):
        await push_one_admin()
        toggled, _ = await _pending()
        untouched, _ = await _pending("Wolverine")

        assert await _toggle(toggled) is True

        assert await _requested_champion_ids(session) == [untouched.id]

    @pytest.mark.asyncio
    async def test_toggle_to_false_keeps_the_request(self, session):
        await push_one_admin()
        champion, _ = await _pending(is_ascendable=True)

        assert await _toggle(champion) is False

        assert await _requested_champion_ids(session) == [champion.id]

    @pytest.mark.asyncio
    async def test_load_with_ascendable_true_removes_the_request(self, session):
        await push_one_admin()
        champion, _ = await _pending()

        response = await execute_post_request(
            "/admin/champions/load",
            [{"name": champion.name, "champion_class": "Cosmic", "is_ascendable": True}],
            headers=ADMIN_HEADERS,
        )

        assert response.status_code == 200
        assert await get_ascension_requests(session) == []

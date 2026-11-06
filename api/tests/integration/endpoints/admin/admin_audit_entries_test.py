"""Integration tests for the Admin Audit read and purge endpoints, super admin only."""

import uuid
from datetime import timedelta, timezone

import pytest
from sqlmodel import select

from src.enums.Roles import Roles
from src.models.Base import utcnow
from src.models.user.AdminAuditEntry import AdminAuditEntry
from tests.integration.endpoints.setup.user_setup import (
    STANDALONE_ADMIN_HEADERS,
    STANDALONE_ADMIN_ID,
    get_generic_user,
    push_one_user,
    push_standalone_admin,
)
from tests.utils.utils_client import create_auth_headers, get_test_client
from tests.utils.utils_constant import USER_ID, USER_LOGIN
from tests.utils.utils_db import load_objects

URL = "/admin/audit-entries"
FILTERS_URL = f"{URL}/filters"
MUTE_ROUTE = "/admin/users/{user_id}/mute"
ALIAS_ROUTE = "/admin/champions/{champion_id}/alias"
LOGINS_ROUTE = "/admin/logins/stats"

SUPER_ID = uuid.uuid4()
SUPER_HEADERS = create_auth_headers(user_id=str(SUPER_ID), role=Roles.SUPER_ADMIN)
NOW = utcnow()


@pytest.fixture(autouse=True)
async def _users_in_db():
    await push_one_user()
    await push_standalone_admin()
    super_admin = get_generic_user(
        login="super_audit", email="super_audit@gmail.com", role=Roles.SUPER_ADMIN
    )
    super_admin.id = SUPER_ID
    super_admin.discord_id = "discord_super_audit"
    await load_objects([super_admin])


def _entry(days_ago: float = 1, **fields) -> AdminAuditEntry:
    defaults = {
        "created_at": NOW - timedelta(days=days_ago),
        "method": "POST",
        "route": MUTE_ROUTE,
        "status_code": 200,
    }
    return AdminAuditEntry(**(defaults | fields))


async def _seed_mixed() -> None:
    await load_objects(
        [
            _entry(days_ago=1, user_id=STANDALONE_ADMIN_ID, role=Roles.ADMIN),
            _entry(days_ago=2, user_id=STANDALONE_ADMIN_ID, role=Roles.ADMIN, status_code=422),
            _entry(
                days_ago=3,
                method="GET",
                route=LOGINS_ROUTE,
                status_code=403,
                user_id=USER_ID,
                role=Roles.USER,
            ),
            _entry(days_ago=4, method="PATCH", route=ALIAS_ROUTE, status_code=404),
            _entry(days_ago=5, method="PATCH", route=ALIAS_ROUTE, status_code=500),
        ]
    )


async def _entries(session) -> list[AdminAuditEntry]:
    return list((await session.exec(select(AdminAuditEntry))).all())


def _pairs(body: dict) -> list[tuple[str, int]]:
    return sorted((item["route"], item["status_code"]) for item in body["items"])


async def _get(url: str, params: dict | None = None):
    async with get_test_client() as client:
        return await client.get(url, params=params, headers=SUPER_HEADERS)


async def _delete(params: dict):
    async with get_test_client() as client:
        return await client.delete(URL, params=params, headers=SUPER_HEADERS)


@pytest.mark.parametrize(
    ("params", "expected"),
    [
        ({"router": "Login Stats"}, [(LOGINS_ROUTE, 403)]),
        ({"route": MUTE_ROUTE}, [(MUTE_ROUTE, 200), (MUTE_ROUTE, 422)]),
        ({"result": "success"}, [(MUTE_ROUTE, 200)]),
        ({"result": "refused"}, [(LOGINS_ROUTE, 403)]),
        ({"result": "error"}, [(MUTE_ROUTE, 422), (ALIAS_ROUTE, 404), (ALIAS_ROUTE, 500)]),
        ({"user_id": str(STANDALONE_ADMIN_ID)}, [(MUTE_ROUTE, 200), (MUTE_ROUTE, 422)]),
        ({"route": ALIAS_ROUTE, "result": "refused"}, []),
    ],
    ids=["router", "route", "success", "refused", "error", "user", "combined"],
)
async def test_list_filters_narrow_the_entries(session, params, expected):
    await _seed_mixed()

    response = await _get(URL, params)

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == len(expected)
    assert _pairs(body) == sorted(expected)


async def test_list_filters_by_period(session):
    await _seed_mixed()

    response = await _get(
        URL,
        {
            "date_from": (NOW - timedelta(days=4, hours=12)).isoformat(),
            "date_to": (NOW - timedelta(days=2, hours=12)).isoformat(),
        },
    )

    assert response.status_code == 200
    assert _pairs(response.json()) == [(ALIAS_ROUTE, 404), (LOGINS_ROUTE, 403)]


async def test_list_period_with_an_offset_still_filters(session):
    await _seed_mixed()
    offset = timezone(timedelta(hours=5))

    response = await _get(
        URL,
        {
            "date_from": (NOW - timedelta(days=4, hours=12)).astimezone(offset).isoformat(),
            "date_to": (NOW - timedelta(days=2, hours=12)).astimezone(offset).isoformat(),
        },
    )

    assert response.status_code == 200
    assert _pairs(response.json()) == [(ALIAS_ROUTE, 404), (LOGINS_ROUTE, 403)]


@pytest.mark.parametrize("param", ["date_from", "date_to"])
async def test_list_refuses_a_naive_date(session, param):
    response = await _get(URL, {param: "2026-11-06"})

    assert response.status_code == 422


async def test_purge_refuses_a_naive_before(session):
    await load_objects([_entry(days_ago=40, status_code=401)])

    response = await _delete({"before": "2026-11-06T00:00:00", "scope": "anonymous"})

    assert response.status_code == 422
    assert len([row for row in await _entries(session) if row.status_code == 401]) == 1


async def test_list_is_paginated_newest_first(session):
    await load_objects([_entry(days_ago=days) for days in (1, 2, 3)])

    first = (await _get(URL, {"size": 2, "page": 1})).json()
    second = (await _get(URL, {"size": 2, "page": 2})).json()

    assert (first["total"], first["page"], first["size"], first["pages"]) == (3, 1, 2, 2)
    assert len(first["items"]) == 2
    assert len(second["items"]) == 1
    assert first["items"][0]["created_at"] > first["items"][1]["created_at"]


async def test_rows_of_the_same_second_stay_on_one_page_each(session):
    rows = [_entry(days_ago=1) for _ in range(3)]
    await load_objects(rows)

    first = (await _get(URL, {"size": 2, "page": 1})).json()
    second = (await _get(URL, {"size": 2, "page": 2})).json()

    listed = [item["id"] for item in first["items"] + second["items"]]
    assert listed == sorted((str(row.id) for row in rows), reverse=True)


async def test_list_row_carries_author_login_and_result(session):
    await _seed_mixed()

    body = (await _get(URL, {"route": LOGINS_ROUTE})).json()

    [item] = body["items"]
    assert item["user_login"] == USER_LOGIN
    assert item["result"] == "refused"
    assert (item["method"], item["role"]) == ("GET", Roles.USER)


async def test_filters_list_audited_routers_and_entry_accounts(session):
    await _seed_mixed()

    body = (await _get(FILTERS_URL)).json()

    routers = {router["name"]: router["routes"] for router in body["routers"]}
    assert LOGINS_ROUTE in routers["Login Stats"]
    assert MUTE_ROUTE in routers["Moderation"]
    assert all(route.startswith("/admin") for paths in routers.values() for route in paths)
    accounts = {account["id"] for account in body["accounts"]}
    assert accounts == {str(STANDALONE_ADMIN_ID), str(USER_ID)}


@pytest.mark.parametrize(
    ("method", "url", "params"),
    [
        ("GET", URL, None),
        ("GET", FILTERS_URL, None),
        ("DELETE", URL, {"before": NOW.isoformat(), "scope": "admins"}),
    ],
    ids=["list", "filters", "purge"],
)
async def test_admin_who_is_not_super_is_refused(session, method, url, params):
    async with get_test_client() as client:
        response = await client.request(
            method, url, params=params, headers=STANDALONE_ADMIN_HEADERS
        )

    assert response.status_code == 403


async def test_purge_anonymous_keeps_recent_rows_and_adds_its_own_entry(session):
    await load_objects(
        [
            _entry(days_ago=40, status_code=401),
            _entry(
                days_ago=40,
                method="GET",
                route=LOGINS_ROUTE,
                status_code=403,
                user_id=USER_ID,
                role=Roles.USER,
            ),
            _entry(days_ago=40, user_id=STANDALONE_ADMIN_ID, role=Roles.ADMIN),
            _entry(days_ago=1, status_code=401),
        ]
    )

    response = await _delete(
        {"before": (NOW - timedelta(days=30)).isoformat(), "scope": "anonymous"}
    )

    assert response.status_code == 200
    assert response.json() == {"deleted": 2}
    rows = await _entries(session)
    assert len(rows) == 3
    [own] = [row for row in rows if row.method == "DELETE"]
    assert (own.role, own.status_code, own.user_id) == (Roles.SUPER_ADMIN, 200, SUPER_ID)


async def test_purge_admins_leaves_anonymous_rows_untouched(session):
    await load_objects(
        [
            _entry(days_ago=40, user_id=STANDALONE_ADMIN_ID, role=Roles.ADMIN),
            _entry(days_ago=40, user_id=SUPER_ID, role=Roles.SUPER_ADMIN),
            _entry(days_ago=40, status_code=401),
        ]
    )

    response = await _delete({"before": (NOW - timedelta(days=30)).isoformat(), "scope": "admins"})

    assert response.status_code == 200
    assert response.json() == {"deleted": 2}
    anonymous = [row for row in await _entries(session) if row.role is None]
    assert [row.status_code for row in anonymous] == [401]

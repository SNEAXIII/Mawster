"""Integration tests for the admin Login activity endpoint."""

from datetime import UTC, datetime, timedelta

import pytest

from main import app
from src.enums.LoginEventKind import LoginEventKind
from src.models.Base import utcnow
from src.models.user.LoginLog import LoginLog
from src.utils.db import get_session
from tests.integration.endpoints.setup.user_setup import (
    STANDALONE_ADMIN_HEADERS,
    push_one_user,
    push_standalone_admin,
    push_user2,
)
from tests.utils.utils_client import create_auth_headers, execute_get_request
from tests.utils.utils_constant import USER2_ID, USER_ID
from tests.utils.utils_db import get_test_session, load_objects

app.dependency_overrides[get_session] = get_test_session

STATS_URL = "/admin/logins/stats"
ALL_TIME = f"{STATS_URL}?days=0"


@pytest.fixture(autouse=True)
async def _users_in_db():
    await push_one_user()
    await push_user2()
    await push_standalone_admin()


def _utc(*parts: int) -> datetime:
    return datetime(*parts, tzinfo=UTC)


async def _push_logins(rows: list[tuple[object, datetime, LoginEventKind]]) -> None:
    await load_objects(
        [LoginLog(user_id=user_id, date_connexion=at, kind=kind) for user_id, at, kind in rows]
    )


def _bucket(items: list[dict], key: str, value: int) -> dict:
    return next(item for item in items if item[key] == value)


# ── Authorisation ────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_endpoint_rejects_anonymous():
    response = await execute_get_request(STATS_URL)
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_endpoint_rejects_plain_user():
    response = await execute_get_request(STATS_URL, headers=create_auth_headers())
    assert response.status_code == 403


# ── Counting ─────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_account_logging_twice_in_one_bucket_counts_once_in_accounts():
    morning = _utc(2026, 11, 2, 10, 0)
    await _push_logins(
        [
            (USER_ID, morning, LoginEventKind.LOGIN),
            (USER_ID, morning + timedelta(minutes=30), LoginEventKind.REFRESH),
        ]
    )

    body = (await execute_get_request(ALL_TIME, headers=STANDALONE_ADMIN_HEADERS)).json()

    assert (body["total_accounts"], body["total_events"]) == (1, 2)
    assert _bucket(body["by_hour"], "hour", 10)["accounts"] == 1
    assert _bucket(body["by_hour"], "hour", 10)["events"] == 2
    assert _bucket(body["by_month"], "month", "2026-11")["events"] == 2


@pytest.mark.asyncio
async def test_kind_filter_keeps_only_the_requested_events():
    at = _utc(2026, 11, 2, 10, 0)
    await _push_logins(
        [
            (USER_ID, at, LoginEventKind.LOGIN),
            (USER_ID, at, LoginEventKind.REFRESH),
            (USER2_ID, at, LoginEventKind.REFRESH),
        ]
    )

    refresh = (
        await execute_get_request(f"{ALL_TIME}&kind=refresh", headers=STANDALONE_ADMIN_HEADERS)
    ).json()
    login = (
        await execute_get_request(f"{ALL_TIME}&kind=login", headers=STANDALONE_ADMIN_HEADERS)
    ).json()
    both = (await execute_get_request(ALL_TIME, headers=STANDALONE_ADMIN_HEADERS)).json()

    assert (refresh["total_accounts"], refresh["total_events"]) == (2, 2)
    assert (login["total_accounts"], login["total_events"]) == (1, 1)
    assert (both["total_accounts"], both["total_events"]) == (2, 3)


@pytest.mark.asyncio
async def test_window_excludes_old_rows_but_all_time_keeps_them():
    await _push_logins([(USER_ID, utcnow() - timedelta(days=40), LoginEventKind.LOGIN)])

    windowed = (
        await execute_get_request(f"{STATS_URL}?days=30", headers=STANDALONE_ADMIN_HEADERS)
    ).json()
    all_time = (await execute_get_request(ALL_TIME, headers=STANDALONE_ADMIN_HEADERS)).json()

    assert windowed["total_events"] == 0
    assert all_time["total_events"] == 1


# ── Time zone ────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_time_zone_moves_an_event_across_midnight_to_another_weekday_and_hour():
    # Monday 2026-11-02 23:30 UTC is Tuesday 08:30 in Tokyo (UTC+9).
    await _push_logins([(USER_ID, _utc(2026, 11, 2, 23, 30), LoginEventKind.LOGIN)])

    utc = (await execute_get_request(ALL_TIME, headers=STANDALONE_ADMIN_HEADERS)).json()
    tokyo = (
        await execute_get_request(f"{ALL_TIME}&tz=Asia/Tokyo", headers=STANDALONE_ADMIN_HEADERS)
    ).json()

    assert _bucket(utc["by_weekday"], "weekday", 0)["events"] == 1
    assert _bucket(utc["by_hour"], "hour", 23)["events"] == 1
    assert _bucket(tokyo["by_weekday"], "weekday", 0)["events"] == 0
    assert _bucket(tokyo["by_weekday"], "weekday", 1)["events"] == 1
    assert _bucket(tokyo["by_hour"], "hour", 8)["events"] == 1
    assert _bucket(tokyo["by_hour"], "hour", 23)["events"] == 0


@pytest.mark.asyncio
async def test_unknown_time_zone_is_rejected():
    response = await execute_get_request(
        f"{ALL_TIME}&tz=Mars/Olympus", headers=STANDALONE_ADMIN_HEADERS
    )
    assert response.status_code == 422


# ── Shape ────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_weekday_and_hour_are_always_full_and_month_list_is_zero_filled():
    await _push_logins(
        [
            (USER_ID, _utc(2026, 1, 15, 12, 0), LoginEventKind.LOGIN),
            (USER2_ID, _utc(2026, 3, 2, 12, 0), LoginEventKind.LOGIN),
        ]
    )

    body = (await execute_get_request(ALL_TIME, headers=STANDALONE_ADMIN_HEADERS)).json()

    assert [day["weekday"] for day in body["by_weekday"]] == list(range(7))
    assert [hour["hour"] for hour in body["by_hour"]] == list(range(24))
    months = {month["month"]: month for month in body["by_month"]}
    assert list(months)[:3] == ["2026-01", "2026-02", "2026-03"]
    assert months["2026-02"] == {"month": "2026-02", "accounts": 0, "events": 0}
    assert list(months)[-1] == utcnow().strftime("%Y-%m")


@pytest.mark.asyncio
async def test_empty_all_time_has_no_months_but_a_window_is_zero_filled():
    all_time = (await execute_get_request(ALL_TIME, headers=STANDALONE_ADMIN_HEADERS)).json()
    windowed = (
        await execute_get_request(f"{STATS_URL}?days=30", headers=STANDALONE_ADMIN_HEADERS)
    ).json()

    assert all_time["by_month"] == []
    assert windowed["by_month"]
    assert all(month["events"] == 0 for month in windowed["by_month"])


@pytest.mark.asyncio
@pytest.mark.parametrize("days", [-1, 366])
async def test_days_query_is_bounded(days: int):
    response = await execute_get_request(
        f"{STATS_URL}?days={days}", headers=STANDALONE_ADMIN_HEADERS
    )
    assert response.status_code == 422

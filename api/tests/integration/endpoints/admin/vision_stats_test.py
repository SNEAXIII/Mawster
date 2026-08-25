"""Integration tests for the admin AI-import dashboard endpoints."""

import uuid
from datetime import UTC, datetime, timedelta

import pytest

from main import app
from src.models.Base import utcnow
from src.models.vision.VisionImport import VisionImport, VisionImportStatus
from src.models.vision.VisionJob import VisionJob, VisionJobStatus
from src.models.vision.VisionPrediction import VisionPrediction
from src.utils.db import get_session
from tests.integration.endpoints.setup.game_setup import push_game_account
from tests.integration.endpoints.setup.user_setup import push_one_user, push_user2
from tests.utils.utils_client import create_auth_headers, execute_get_request
from tests.utils.utils_constant import GAME_PSEUDO, GAME_PSEUDO_2, USER2_ID, USER_ID
from tests.utils.utils_db import get_test_session, load_objects

app.dependency_overrides[get_session] = get_test_session

STATS_URL = "/admin/vision/stats"
USERS_URL = "/admin/vision/users"
IMPORTS_URL = "/admin/vision/imports"


def admin_headers() -> dict[str, str]:
    return create_auth_headers(role="admin")


async def _push_import(
    game_account_id: uuid.UUID,
    status: VisionImportStatus,
    screens: int = 2,
    created_at: datetime | None = None,
    share_dataset: bool = False,
) -> VisionImport:
    vision_import = VisionImport(
        id=uuid.uuid4(),
        game_account_id=game_account_id,
        status=status,
        screens_total=screens,
        screens_done=screens,
        share_dataset=share_dataset,
    )
    if created_at is not None:
        vision_import.created_at = created_at
    await load_objects([vision_import])
    return vision_import


async def _push_job(
    vision_import: VisionImport,
    status: VisionJobStatus = VisionJobStatus.DONE,
    error: str | None = None,
    predictions: int = 0,
    created_at: datetime | None = None,
    unidentified: int = 0,
    reranked: int = 0,
) -> VisionJob:
    job = VisionJob(
        id=uuid.uuid4(),
        import_id=vision_import.id,
        status=status,
        object_key=f"screens/{uuid.uuid4()}.png",
        error=error,
    )
    if created_at is not None:
        job.created_at = created_at
    await load_objects([job])
    rows = [
        VisionPrediction(
            id=uuid.uuid4(),
            job_id=job.id,
            champion_name=None if index < unidentified else f"Champ{index}",
            stars=6,
            rank=3,
            confidence=0.5,
            reranked=index < reranked,
        )
        for index in range(predictions)
    ]
    if rows:
        await load_objects(rows)
    return job


async def _two_users_with_imports():
    """USER_ID: 2 confirmed + 1 cancelled. USER2_ID: 1 confirmed."""
    await push_one_user()
    await push_user2()
    account1 = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
    account2 = await push_game_account(user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)

    first = await _push_import(account1.id, VisionImportStatus.CONFIRMED, screens=3)
    await _push_import(account1.id, VisionImportStatus.CONFIRMED, screens=1, share_dataset=True)
    await _push_import(account1.id, VisionImportStatus.CANCELLED, screens=2)
    second = await _push_import(account2.id, VisionImportStatus.CONFIRMED, screens=4)

    await _push_job(first, predictions=3, unidentified=1, reranked=1)
    await _push_job(first, status=VisionJobStatus.FAILED, error="unreadable screenshot")
    await _push_job(second, predictions=2)
    return account1, account2


# ── Authorisation ────────────────────────────────────────────────────────


@pytest.mark.asyncio
@pytest.mark.parametrize("url", [STATS_URL, USERS_URL, IMPORTS_URL])
async def test_endpoints_reject_anonymous(url: str):
    response = await execute_get_request(url)
    assert response.status_code == 401


@pytest.mark.asyncio
@pytest.mark.parametrize("url", [STATS_URL, USERS_URL, IMPORTS_URL])
async def test_endpoints_reject_plain_user(url: str):
    await push_one_user()
    response = await execute_get_request(url, headers=create_auth_headers())
    assert response.status_code == 403


# ── Overview ─────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_stats_overview_counts_every_outcome():
    await _two_users_with_imports()

    response = await execute_get_request(STATS_URL, headers=admin_headers())

    assert response.status_code == 200
    overview = response.json()["overview"]
    assert overview["imports_total"] == 4
    assert overview["imports_confirmed"] == 3
    assert overview["imports_cancelled"] == 1
    assert overview["imports_failed"] == 0
    assert overview["imports_in_progress"] == 0
    assert overview["screens_total"] == 10
    assert overview["distinct_users"] == 2
    assert overview["distinct_game_accounts"] == 2
    assert overview["shared_dataset_imports"] == 1
    # 3 confirmed out of 4 finished imports.
    assert overview["confirm_rate"] == 0.75
    assert overview["avg_screens_per_import"] == 2.5


@pytest.mark.asyncio
async def test_stats_overview_reports_model_quality():
    await _two_users_with_imports()

    overview = (await execute_get_request(STATS_URL, headers=admin_headers())).json()["overview"]

    assert overview["jobs_total"] == 3
    assert overview["jobs_failed"] == 1
    assert overview["job_failure_rate"] == round(1 / 3, 4)
    assert overview["predictions_total"] == 5
    assert overview["unidentified_predictions"] == 1
    assert overview["reranked_predictions"] == 1
    assert overview["avg_confidence"] == 0.5


@pytest.mark.asyncio
async def test_stats_overview_is_zeroed_without_imports():
    await push_one_user()

    body = (await execute_get_request(STATS_URL, headers=admin_headers())).json()

    assert body["overview"]["imports_total"] == 0
    assert body["overview"]["confirm_rate"] == 0.0
    assert body["overview"]["avg_confidence"] is None
    assert body["top_errors"] == []


@pytest.mark.asyncio
async def test_stats_window_excludes_older_imports_but_all_time_keeps_them():
    await push_one_user()
    account = await push_game_account(user_id=USER_ID)
    await _push_import(account.id, VisionImportStatus.CONFIRMED)
    await _push_import(
        account.id,
        VisionImportStatus.CONFIRMED,
        created_at=utcnow() - timedelta(days=40),
    )

    windowed = (await execute_get_request(f"{STATS_URL}?days=7", headers=admin_headers())).json()
    all_time = (await execute_get_request(f"{STATS_URL}?days=0", headers=admin_headers())).json()

    assert windowed["overview"]["imports_total"] == 1
    # The all-time counter is reported whatever the window, so the dashboard can
    # always show "of which, ever".
    assert windowed["overview"]["imports_all_time"] == 2
    assert all_time["overview"]["imports_total"] == 2


# ── Daily series ─────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_daily_series_is_zero_filled_over_the_window():
    await push_one_user()
    account = await push_game_account(user_id=USER_ID)
    await _push_import(account.id, VisionImportStatus.CONFIRMED, screens=3)

    body = (await execute_get_request(f"{STATS_URL}?days=7", headers=admin_headers())).json()

    daily = body["daily"]
    assert len(daily) == 7
    assert daily[-1]["day"] == utcnow().astimezone(UTC).date().isoformat()
    assert daily[-1]["imports"] == 1
    assert daily[-1]["screens"] == 3
    assert daily[-1]["confirmed"] == 1
    assert all(point["imports"] == 0 for point in daily[:-1])


@pytest.mark.asyncio
async def test_daily_series_all_time_only_returns_days_with_data():
    await push_one_user()
    account = await push_game_account(user_id=USER_ID)
    await _push_import(account.id, VisionImportStatus.CONFIRMED)
    await _push_import(
        account.id, VisionImportStatus.CONFIRMED, created_at=utcnow() - timedelta(days=200)
    )

    body = (await execute_get_request(f"{STATS_URL}?days=0", headers=admin_headers())).json()

    assert len(body["daily"]) == 2


# ── Top errors ───────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_top_errors_groups_failures_by_message():
    await push_one_user()
    account = await push_game_account(user_id=USER_ID)
    vision_import = await _push_import(account.id, VisionImportStatus.FAILED)
    for _ in range(2):
        await _push_job(vision_import, status=VisionJobStatus.FAILED, error="blurry")
    await _push_job(vision_import, status=VisionJobStatus.FAILED, error="empty")

    body = (await execute_get_request(STATS_URL, headers=admin_headers())).json()

    assert body["top_errors"][0] == {"error": "blurry", "count": 2}
    assert {"error": "empty", "count": 1} in body["top_errors"]


# ── Per-user leaderboard ─────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_user_stats_ranks_importers_and_keeps_sums_unfanned():
    await _two_users_with_imports()

    body = (await execute_get_request(USERS_URL, headers=admin_headers())).json()

    assert body["total"] == 2
    top = body["items"][0]
    assert top["imports_total"] == 3
    assert top["imports_confirmed"] == 2
    assert top["imports_cancelled"] == 1
    # 3 + 1 + 2 — not multiplied by the two jobs hanging off the first import.
    assert top["screens_total"] == 6
    assert top["predictions_total"] == 3
    assert top["shared_dataset_imports"] == 1
    assert top["confirm_rate"] == round(2 / 3, 4)
    assert top["game_pseudos"] == [GAME_PSEUDO]
    assert top["last_import_at"] is not None


@pytest.mark.asyncio
async def test_user_stats_sorting_and_pagination():
    await _two_users_with_imports()

    ascending = (
        await execute_get_request(
            f"{USERS_URL}?sort_by=imports_total&sort_order=asc&size=1", headers=admin_headers()
        )
    ).json()

    assert ascending["pages"] == 2
    assert ascending["items"][0]["imports_total"] == 1


@pytest.mark.asyncio
async def test_user_stats_lists_every_game_pseudo_of_a_user():
    await push_one_user()
    account = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
    await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO_2)
    await _push_import(account.id, VisionImportStatus.CONFIRMED)

    body = (await execute_get_request(USERS_URL, headers=admin_headers())).json()

    assert sorted(body["items"][0]["game_pseudos"]) == sorted([GAME_PSEUDO, GAME_PSEUDO_2])
    # The extra account must not double the import count.
    assert body["items"][0]["imports_total"] == 1


# ── Import log ───────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_imports_log_returns_newest_first_with_author():
    await push_one_user()
    account = await push_game_account(user_id=USER_ID)
    await _push_import(
        account.id, VisionImportStatus.CONFIRMED, created_at=utcnow() - timedelta(hours=2)
    )
    newest = await _push_import(account.id, VisionImportStatus.CANCELLED)

    body = (await execute_get_request(IMPORTS_URL, headers=admin_headers())).json()

    assert body["total"] == 2
    assert body["items"][0]["id"] == str(newest.id)
    assert body["items"][0]["status"] == "cancelled"
    assert body["items"][0]["game_pseudo"] == GAME_PSEUDO
    assert body["items"][0]["user_id"] == str(USER_ID)


@pytest.mark.asyncio
async def test_imports_log_rolls_up_failed_jobs_and_predictions():
    await push_one_user()
    account = await push_game_account(user_id=USER_ID)
    vision_import = await _push_import(account.id, VisionImportStatus.DONE)
    await _push_job(vision_import, predictions=4)
    await _push_job(vision_import, status=VisionJobStatus.FAILED, error="blurry")

    body = (await execute_get_request(IMPORTS_URL, headers=admin_headers())).json()

    assert body["items"][0]["jobs_failed"] == 1
    assert body["items"][0]["predictions_total"] == 4


@pytest.mark.asyncio
async def test_imports_log_filters_by_status_and_user():
    await _two_users_with_imports()

    cancelled = (
        await execute_get_request(f"{IMPORTS_URL}?status=cancelled", headers=admin_headers())
    ).json()
    by_user = (
        await execute_get_request(f"{IMPORTS_URL}?user_id={USER2_ID}", headers=admin_headers())
    ).json()

    assert cancelled["total"] == 1
    assert cancelled["items"][0]["status"] == "cancelled"
    assert by_user["total"] == 1
    assert by_user["items"][0]["user_id"] == str(USER2_ID)


@pytest.mark.asyncio
async def test_days_query_is_bounded():
    await push_one_user()

    assert (
        await execute_get_request(f"{STATS_URL}?days=400", headers=admin_headers())
    ).status_code == 422
    assert (
        await execute_get_request(f"{STATS_URL}?days=-1", headers=admin_headers())
    ).status_code == 422

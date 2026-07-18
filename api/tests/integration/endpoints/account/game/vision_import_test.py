"""Integration tests for /vision endpoints (upload, progress, ownership)."""

import io
import uuid

import pytest
from main import app

from src.messaging import get_publisher
from src.storage import get_storage
from src.utils.db import get_session
from tests.integration.endpoints.setup.game_setup import push_game_account
from tests.integration.endpoints.setup.user_setup import push_one_user, push_user2
from tests.utils.utils_client import create_auth_headers, get_test_client
from tests.utils.utils_constant import GAME_PSEUDO, GAME_PSEUDO_2, USER2_ID, USER_ID
from tests.utils.utils_db import get_test_session

app.dependency_overrides[get_session] = get_test_session


class FakeStorage:
    """In-memory Storage: the tests never talk to RustFS."""

    def __init__(self):
        self.objects: dict[str, bytes] = {}

    async def put_bytes(self, bucket: str, key: str, data: bytes, content_type: str) -> None:
        self.objects[key] = data

    async def get_bytes(self, bucket: str, key: str) -> bytes:
        return self.objects[key]

    async def presign_get(self, bucket: str, key: str, expires_in: int) -> str:
        return f"http://fake/{key}"

    async def delete_prefix(self, bucket: str, prefix: str) -> None:
        for key in [key for key in self.objects if key.startswith(prefix)]:
            del self.objects[key]


class FakePublisher:
    """Records published jobs instead of hitting RabbitMQ."""

    def __init__(self):
        self.published: list[dict] = []
        self.fail_next = False

    async def publish_job(self, job_id, import_id, bucket, object_key) -> None:
        if self.fail_next:
            self.fail_next = False
            raise RuntimeError("broker unavailable")
        self.published.append(
            {
                "job_id": job_id,
                "import_id": import_id,
                "bucket": bucket,
                "object_key": object_key,
            }
        )


@pytest.fixture
def fake_infra():
    storage = FakeStorage()
    publisher = FakePublisher()
    app.dependency_overrides[get_storage] = lambda: storage
    app.dependency_overrides[get_publisher] = lambda: publisher
    yield storage, publisher
    app.dependency_overrides.pop(get_storage, None)
    app.dependency_overrides.pop(get_publisher, None)


def _png(name: str) -> tuple[str, tuple[str, io.BytesIO, str]]:
    return ("files", (name, io.BytesIO(b"\x89PNG\r\n\x1a\n" + b"0" * 64), "image/png"))


async def _post_import(headers, game_account_id, files, share_dataset: str = "false"):
    async with get_test_client() as client:
        return await client.post(
            "/vision/imports",
            headers=headers,
            data={"game_account_id": str(game_account_id), "share_dataset": share_dataset},
            files=files,
        )


async def _get_import(headers, import_id) -> dict:
    async with get_test_client() as client:
        response = await client.get(f"/vision/imports/{import_id}", headers=headers)
        return response.json()


async def _fail_job(job_id: str) -> None:
    """Drive a job into FAILED through the real service, exactly as a worker
    failure would — rather than poking the row by hand."""
    from src.dto.account.game.dto_vision_result import VisionResultMessage
    from src.models.VisionJob import VisionJob
    from src.services.account.game.VisionResultService import VisionResultService
    from tests.utils.utils_db import get_test_session

    async for session in get_test_session():
        job = await session.get(VisionJob, uuid.UUID(job_id))
        await VisionResultService.handle(
            session,
            VisionResultMessage(
                job_id=job.id,
                import_id=job.import_id,
                status="failed",
                error="not a roster",
            ),
        )
        break


@pytest.mark.asyncio
async def test_create_import_stores_screens_and_publishes_one_job_each(fake_infra):
    storage, publisher = fake_infra
    await push_one_user()
    account = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)

    response = await _post_import(
        create_auth_headers(str(USER_ID)), account.id, [_png("a.png"), _png("b.png")]
    )

    assert response.status_code == 201
    body = response.json()
    assert body["screens_total"] == 2
    assert body["screens_done"] == 0
    assert body["status"] == "pending"
    assert len(storage.objects) == 2
    assert len(publisher.published) == 2
    assert all(body["id"] in job["object_key"] for job in publisher.published)


@pytest.mark.asyncio
async def test_create_import_rejects_non_image(fake_infra):
    await push_one_user()
    account = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)

    response = await _post_import(
        create_auth_headers(str(USER_ID)),
        account.id,
        [("files", ("roster.pdf", io.BytesIO(b"%PDF"), "application/pdf"))],
    )

    assert response.status_code == 400


@pytest.mark.asyncio
async def test_create_import_rejects_someone_elses_game_account(fake_infra):
    await push_one_user()
    await push_user2()
    owner_account = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
    await push_game_account(user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)

    response = await _post_import(
        create_auth_headers(str(USER2_ID)), owner_account.id, [_png("a.png")]
    )

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_get_import_returns_progress_and_jobs(fake_infra):
    await push_one_user()
    account = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
    headers = create_auth_headers(str(USER_ID))

    created = await _post_import(headers, account.id, [_png("a.png")])
    import_id = created.json()["id"]

    async with get_test_client() as client:
        response = await client.get(f"/vision/imports/{import_id}", headers=headers)

    assert response.status_code == 200
    body = response.json()
    assert body["screens_total"] == 1
    assert len(body["jobs"]) == 1
    assert body["jobs"][0]["status"] == "pending"


@pytest.mark.asyncio
async def test_get_import_of_another_user_is_forbidden(fake_infra):
    await push_one_user()
    await push_user2()
    owner_account = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
    await push_game_account(user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)

    created = await _post_import(
        create_auth_headers(str(USER_ID)), owner_account.id, [_png("a.png")]
    )
    import_id = created.json()["id"]

    async with get_test_client() as client:
        response = await client.get(
            f"/vision/imports/{import_id}", headers=create_auth_headers(str(USER2_ID))
        )

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_delete_import_of_another_user_is_forbidden(fake_infra):
    await push_one_user()
    await push_user2()
    owner_account = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
    await push_game_account(user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)

    created = await _post_import(
        create_auth_headers(str(USER_ID)), owner_account.id, [_png("a.png")]
    )
    import_id = created.json()["id"]

    async with get_test_client() as client:
        deleted = await client.delete(
            f"/vision/imports/{import_id}", headers=create_auth_headers(str(USER2_ID))
        )
        # Verify the import still exists by checking the owner can still GET it
        still_exists = await client.get(
            f"/vision/imports/{import_id}", headers=create_auth_headers(str(USER_ID))
        )

    assert deleted.status_code == 403
    assert still_exists.status_code == 200


@pytest.mark.asyncio
async def test_get_unknown_import_is_404(fake_infra):
    await push_one_user()

    async with get_test_client() as client:
        response = await client.get(
            f"/vision/imports/{uuid.uuid4()}", headers=create_auth_headers(str(USER_ID))
        )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_import_removes_it(fake_infra):
    await push_one_user()
    account = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
    headers = create_auth_headers(str(USER_ID))

    created = await _post_import(headers, account.id, [_png("a.png")])
    import_id = created.json()["id"]

    async with get_test_client() as client:
        deleted = await client.delete(f"/vision/imports/{import_id}", headers=headers)
        after = await client.get(f"/vision/imports/{import_id}", headers=headers)

    assert deleted.status_code == 204
    assert after.status_code == 404


@pytest.mark.asyncio
async def test_import_requires_authentication(fake_infra):
    async with get_test_client() as client:
        response = await client.post("/vision/imports", files=[_png("a.png")])

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_retry_of_a_failed_job_requeues_it(fake_infra):
    _, publisher = fake_infra
    await push_one_user()
    account = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
    headers = create_auth_headers(str(USER_ID))

    created = await _post_import(headers, account.id, [_png("a.png")])
    import_id = created.json()["id"]
    detail = await _get_import(headers, import_id)
    job_id = detail["jobs"][0]["id"]

    await _fail_job(job_id)  # helper below
    publisher.published.clear()

    async with get_test_client() as client:
        response = await client.post(f"/vision/jobs/{job_id}/retry", headers=headers)

    assert response.status_code == 202
    assert len(publisher.published) == 1

    after = await _get_import(headers, import_id)
    assert after["jobs"][0]["status"] == "pending"
    assert after["screens_done"] == 0


@pytest.mark.asyncio
async def test_retry_of_a_job_that_did_not_fail_is_rejected(fake_infra):
    await push_one_user()
    account = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
    headers = create_auth_headers(str(USER_ID))

    created = await _post_import(headers, account.id, [_png("a.png")])
    detail = await _get_import(headers, created.json()["id"])
    job_id = detail["jobs"][0]["id"]

    async with get_test_client() as client:
        response = await client.post(f"/vision/jobs/{job_id}/retry", headers=headers)

    assert response.status_code == 409


@pytest.mark.asyncio
async def test_retry_reverts_to_failed_when_publish_fails(fake_infra):
    """A broker blip during retry must not strand the job PENDING-but-unqueued:
    only FAILED jobs are retryable, so that state would be unrecoverable."""
    _, publisher = fake_infra
    await push_one_user()
    account = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
    headers = create_auth_headers(str(USER_ID))

    created = await _post_import(headers, account.id, [_png("a.png")])
    import_id = created.json()["id"]
    detail = await _get_import(headers, import_id)
    job_id = detail["jobs"][0]["id"]

    await _fail_job(job_id)
    publisher.published.clear()
    publisher.fail_next = True

    async with get_test_client() as client:
        response = await client.post(f"/vision/jobs/{job_id}/retry", headers=headers)

    assert response.status_code == 503
    assert publisher.published == []

    after = await _get_import(headers, import_id)
    assert after["jobs"][0]["status"] == "failed"
    assert after["screens_done"] == 1

    # The job is FAILED again, so it is still retryable through the normal path.
    async with get_test_client() as client:
        retried = await client.post(f"/vision/jobs/{job_id}/retry", headers=headers)

    assert retried.status_code == 202


@pytest.mark.asyncio
async def test_predictions_endpoint_returns_staged_rows(fake_infra):
    await push_one_user()
    account = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
    headers = create_auth_headers(str(USER_ID))
    created = await _post_import(headers, account.id, [_png("a.png")])
    import_id = created.json()["id"]
    detail = await _get_import(headers, import_id)
    job_id = detail["jobs"][0]["id"]

    # Drive the job to done with one prediction through the real service.
    from src.dto.account.game.dto_vision_result import (
        VisionPredictionMessage,
        VisionResultMessage,
    )
    from src.models.VisionJob import VisionJob
    from src.services.account.game.VisionResultService import VisionResultService

    async for session in get_test_session():
        job = await session.get(VisionJob, uuid.UUID(job_id))
        await VisionResultService.handle(
            session,
            VisionResultMessage(
                job_id=job.id,
                import_id=job.import_id,
                status="done",
                result_key="imports/a/b/result.json",
                predictions=[
                    VisionPredictionMessage(
                        champion_name="Hulk",
                        champion_class="Science",
                        stars=7,
                        rank=3,
                        signature=200,
                        ascension=1,
                        confidence=0.9,
                        crop_key="imports/a/b/crops/0.png",
                    )
                ],
            ),
        )
        break

    async with get_test_client() as client:
        response = await client.get(f"/vision/imports/{import_id}/predictions", headers=headers)

    assert response.status_code == 200
    body = response.json()
    assert len(body["predictions"]) == 1
    assert body["predictions"][0]["champion_name"] == "Hulk"
    assert body["predictions"][0]["crop_index"] == 0


@pytest.mark.asyncio
async def test_predictions_endpoint_of_another_user_is_forbidden(fake_infra):
    await push_one_user()
    await push_user2()
    owner_account = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
    await push_game_account(user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)

    created = await _post_import(
        create_auth_headers(str(USER_ID)), owner_account.id, [_png("a.png")]
    )
    import_id = created.json()["id"]

    async with get_test_client() as client:
        response = await client.get(
            f"/vision/imports/{import_id}/predictions",
            headers=create_auth_headers(str(USER2_ID)),
        )

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_crop_presigned_url_for_owner(fake_infra):
    await push_one_user()
    account = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
    headers = create_auth_headers(str(USER_ID))
    created = await _post_import(headers, account.id, [_png("a.png")])
    import_id = created.json()["id"]
    detail = await _get_import(headers, import_id)
    job_id = detail["jobs"][0]["id"]

    async with get_test_client() as client:
        response = await client.get(
            f"/vision/imports/{import_id}/jobs/{job_id}/crops/0", headers=headers
        )

    assert response.status_code == 200
    assert response.json()["url"].startswith("http")


@pytest.mark.asyncio
async def test_crop_presigned_url_forbidden_for_non_owner(fake_infra):
    await push_one_user()
    await push_user2()
    owner_account = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
    await push_game_account(user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)
    created = await _post_import(
        create_auth_headers(str(USER_ID)), owner_account.id, [_png("a.png")]
    )
    import_id = created.json()["id"]
    detail = await _get_import(create_auth_headers(str(USER_ID)), import_id)
    job_id = detail["jobs"][0]["id"]

    async with get_test_client() as client:
        response = await client.get(
            f"/vision/imports/{import_id}/jobs/{job_id}/crops/0",
            headers=create_auth_headers(str(USER2_ID)),
        )

    assert response.status_code == 403


async def _drive_job_done_with_prediction(job_id: str) -> None:
    """Drive a job to DONE with one prediction through the real service, exactly
    as the vision worker would report a successful read."""
    from src.dto.account.game.dto_vision_result import (
        VisionPredictionMessage,
        VisionResultMessage,
    )
    from src.models.VisionJob import VisionJob
    from src.services.account.game.VisionResultService import VisionResultService

    async for session in get_test_session():
        job = await session.get(VisionJob, uuid.UUID(job_id))
        await VisionResultService.handle(
            session,
            VisionResultMessage(
                job_id=job.id,
                import_id=job.import_id,
                status="done",
                result_key="imports/a/b/result.json",
                predictions=[
                    VisionPredictionMessage(
                        champion_name="Hulk",
                        champion_class="Science",
                        stars=7,
                        rank=3,
                        signature=200,
                        ascension=1,
                        confidence=0.9,
                        crop_key="imports/a/b/crops/0.png",
                    )
                ],
            ),
        )
        break


@pytest.mark.asyncio
async def test_confirm_archives_one_sample_per_row_when_opted_in(fake_infra):
    storage, _ = fake_infra
    await push_one_user()
    account = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
    headers = create_auth_headers(str(USER_ID))

    created = await _post_import(headers, account.id, [_png("a.png")], share_dataset="true")
    import_id = created.json()["id"]
    detail = await _get_import(headers, import_id)
    job_id = detail["jobs"][0]["id"]
    await _drive_job_done_with_prediction(job_id)

    async with get_test_client() as client:
        predictions = await client.get(f"/vision/imports/{import_id}/predictions", headers=headers)
    prediction_id = predictions.json()["predictions"][0]["id"]

    async with get_test_client() as client:
        response = await client.post(
            f"/vision/imports/{import_id}/confirm",
            headers=headers,
            json={
                "rows": [
                    {
                        "champion_name": "Hulk",
                        "rarity": "7r3",
                        "signature": 200,
                        "ascension": 1,
                        "is_preferred_attacker": False,
                        "prediction_id": prediction_id,
                    }
                ]
            },
        )

    assert response.status_code == 200
    assert response.json()["samples_archived"] == 1
    assert len(storage.objects) == 2  # the uploaded screen + the archived sample

    after = await _get_import(headers, import_id)
    assert after["status"] == "confirmed"


@pytest.mark.asyncio
async def test_confirm_archives_nothing_without_opt_in(fake_infra):
    storage, _ = fake_infra
    await push_one_user()
    account = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
    headers = create_auth_headers(str(USER_ID))

    created = await _post_import(headers, account.id, [_png("a.png")], share_dataset="false")
    import_id = created.json()["id"]
    detail = await _get_import(headers, import_id)
    job_id = detail["jobs"][0]["id"]
    await _drive_job_done_with_prediction(job_id)

    async with get_test_client() as client:
        response = await client.post(
            f"/vision/imports/{import_id}/confirm",
            headers=headers,
            json={
                "rows": [
                    {
                        "champion_name": "Hulk",
                        "rarity": "7r3",
                        "signature": 200,
                        "ascension": 1,
                        "is_preferred_attacker": False,
                        "prediction_id": None,
                    }
                ]
            },
        )

    assert response.status_code == 200
    assert response.json()["samples_archived"] == 0
    assert len(storage.objects) == 1  # only the uploaded screen, nothing archived

    after = await _get_import(headers, import_id)
    assert after["status"] == "confirmed"


@pytest.mark.asyncio
async def test_confirm_of_another_users_import_is_forbidden(fake_infra):
    await push_one_user()
    await push_user2()
    owner_account = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
    await push_game_account(user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)

    created = await _post_import(
        create_auth_headers(str(USER_ID)), owner_account.id, [_png("a.png")]
    )
    import_id = created.json()["id"]

    async with get_test_client() as client:
        response = await client.post(
            f"/vision/imports/{import_id}/confirm",
            headers=create_auth_headers(str(USER2_ID)),
            json={"rows": []},
        )

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_retry_of_another_users_job_is_forbidden(fake_infra):
    await push_one_user()
    await push_user2()
    owner_account = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
    await push_game_account(user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)

    created = await _post_import(
        create_auth_headers(str(USER_ID)), owner_account.id, [_png("a.png")]
    )
    detail = await _get_import(create_auth_headers(str(USER_ID)), created.json()["id"])
    job_id = detail["jobs"][0]["id"]
    await _fail_job(job_id)

    async with get_test_client() as client:
        response = await client.post(
            f"/vision/jobs/{job_id}/retry", headers=create_auth_headers(str(USER2_ID))
        )

    assert response.status_code == 403

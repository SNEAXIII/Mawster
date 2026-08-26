"""Integration tests for /vision endpoints (upload, progress, ownership)."""

import io
import uuid
from datetime import UTC, datetime, timedelta

import pytest
from botocore.exceptions import ClientError

from main import app
from src.dto.account.game.dto_vision_result import (
    VisionPredictionMessage,
    VisionResultMessage,
)
from src.messaging import get_publisher
from src.models.vision.VisionImport import VisionImport, VisionImportStatus
from src.models.vision.VisionJob import VisionJob
from src.security.secrets import SECRET
from src.services.account.game.VisionImportService import UPLOAD_URL_TTL_SECONDS
from src.services.account.game.VisionResultService import VisionResultService
from src.storage import get_storage
from src.storage.base import ObjectStat, screen_key, sprite_key
from src.utils.db import get_session
from tests.integration.endpoints.setup.game_setup import push_game_account
from tests.integration.endpoints.setup.user_setup import push_one_user, push_user2
from tests.utils.utils_client import create_auth_headers, get_test_client
from tests.utils.utils_constant import GAME_PSEUDO, GAME_PSEUDO_2, USER2_ID, USER_ID
from tests.utils.utils_db import get_test_session

app.dependency_overrides[get_session] = get_test_session


PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"0" * 64


class FakeStorage:
    """In-memory Storage: the tests never talk to RustFS."""

    def __init__(self):
        self.objects: dict[str, bytes] = {}
        self.content_types: dict[str, str] = {}

    async def put_bytes(self, bucket: str, key: str, data: bytes, content_type: str) -> None:
        self.objects[key] = data
        self.content_types[key] = content_type

    async def presigned_put_url(
        self, bucket: str, key: str, content_type: str, expires_in: int
    ) -> str:
        return f"https://s3.test/{bucket}/{key}?exp={expires_in}"

    async def stat_object(self, bucket: str, key: str):

        if key not in self.objects:
            return None
        return ObjectStat(size=len(self.objects[key]), content_type=self.content_types[key])

    async def get_head_bytes(self, bucket: str, key: str, length: int) -> bytes:
        return self.objects[key][:length]

    def browser_put(self, key: str, data: bytes = PNG_BYTES, content_type: str = "image/png"):
        """What the browser does against a presigned URL — bytes appear in the
        bucket without the API seeing them, which is the whole point of the flow."""
        self.objects[key] = data
        self.content_types[key] = content_type

    async def get_bytes(self, bucket: str, key: str) -> bytes:
        if key not in self.objects:
            # Real shape of a missing-object error from aioboto3/botocore, so the
            # controller's `except ClientError` branch sees the same thing it
            # would against real RustFS.
            raise ClientError(
                {"Error": {"Code": "NoSuchKey"}, "ResponseMetadata": {"HTTPStatusCode": 404}},
                "GetObject",
            )
        return self.objects[key]

    async def delete_prefix(self, bucket: str, prefix: str) -> None:
        for key in [key for key in self.objects if key.startswith(prefix)]:
            del self.objects[key]
            self.content_types.pop(key, None)


class FakePublisher:
    """Records published jobs instead of hitting RabbitMQ."""

    def __init__(self):
        self.published: list[dict] = []
        self.fail_next = False

    async def publish_job(self, job_id, import_id, bucket, object_key) -> None:
        if self.fail_next:
            self.fail_next = False
            msg = "broker unavailable"
            raise RuntimeError(msg)
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
async def test_delete_import_cancels_it_without_deleting_the_row(fake_infra):
    await push_one_user()
    account = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
    headers = create_auth_headers(str(USER_ID))

    created = await _post_import(headers, account.id, [_png("a.png")])
    import_id = created.json()["id"]

    async with get_test_client() as client:
        deleted = await client.delete(f"/vision/imports/{import_id}", headers=headers)
        after = await client.get(f"/vision/imports/{import_id}", headers=headers)

    assert deleted.status_code == 204
    assert after.status_code == 200
    assert after.json()["status"] == "cancelled"


@pytest.mark.asyncio
async def test_cancel_keeps_the_row_so_the_quota_still_counts_it(fake_infra):
    """The hourly quota counts rows. If cancelling deleted them, create -> cancel
    -> create would slip under the limit forever."""
    await push_one_user()
    account = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
    headers = create_auth_headers(str(USER_ID))
    created = await _post_import(headers, account.id, [_png("a.png")])
    import_id = created.json()["id"]

    async with get_test_client() as client:
        response = await client.delete(f"/vision/imports/{import_id}", headers=headers)

    assert response.status_code == 204

    async for session in get_test_session():
        row = await session.get(VisionImport, uuid.UUID(import_id))
        assert row is not None, "cancelling must NOT delete the row"
        assert row.status == VisionImportStatus.CANCELLED
        break


@pytest.mark.asyncio
async def test_cancel_purges_the_bucket_objects(fake_infra):
    storage, _ = fake_infra
    await push_one_user()
    account = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
    headers = create_auth_headers(str(USER_ID))
    created = await _post_import(headers, account.id, [_png("a.png")])
    import_id = created.json()["id"]

    async with get_test_client() as client:
        await client.delete(f"/vision/imports/{import_id}", headers=headers)

    assert storage.objects == {}


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
                        crop_key="imports/a/b/crops/sprite_v1.webp#0",
                        candidates=[
                            {"name": "Hulk", "score": 0.90},
                            {"name": "Red Hulk", "score": 0.62},
                        ],
                    ),
                    # A card the pixel second pass corrected: the winner keeps its
                    # own lower CLIP cosine, so the stored order is inverted and
                    # the derived margin comes out negative.
                    VisionPredictionMessage(
                        champion_name="Spider-Man (Stark Enhanced)",
                        champion_class="Science",
                        stars=7,
                        rank=5,
                        signature=200,
                        ascension=0,
                        confidence=0.8528,
                        reranked=True,
                        crop_key="imports/a/b/crops/sprite_v1.webp#1",
                        candidates=[
                            {"name": "Spider-Man (Stark Enhanced)", "score": 0.8528},
                            {"name": "Spider-Man (Classic)", "score": 0.8561},
                        ],
                    ),
                ],
            ),
        )
        break

    async with get_test_client() as client:
        response = await client.get(f"/vision/imports/{import_id}/predictions", headers=headers)

    assert response.status_code == 200
    body = response.json()
    assert len(body["predictions"]) == 2
    # Rows come back ordered by a uuid4 primary key, so index by name, not position.
    by_name = {p["champion_name"]: p for p in body["predictions"]}
    assert by_name["Hulk"]["crop_index"] == 0

    # The candidates survive the whole round trip — worker message, child table,
    # eager load, response — and come back best first. The unit test for _margin
    # proves the arithmetic; only this proves the wiring under it.
    row = by_name["Hulk"]
    assert [(c["name"], c["score"]) for c in row["candidates"]] == [
        ("Hulk", 0.90),
        ("Red Hulk", 0.62),
    ]
    assert row["margin"] == pytest.approx(0.28)
    assert row["reranked"] is False

    # The corrected card: `position` preserved the inverted order the second pass
    # produced, so the margin is negative and the flag says why.
    fixed = by_name["Spider-Man (Stark Enhanced)"]
    assert fixed["reranked"] is True
    assert fixed["crop_index"] == 1
    assert [c["name"] for c in fixed["candidates"]] == [
        "Spider-Man (Stark Enhanced)",
        "Spider-Man (Classic)",
    ]
    assert fixed["margin"] == pytest.approx(-0.0033)


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
async def test_sprite_bytes_for_owner(fake_infra):
    storage, _ = fake_infra
    await push_one_user()
    account = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
    headers = create_auth_headers(str(USER_ID))
    created = await _post_import(headers, account.id, [_png("a.png")])
    import_id = created.json()["id"]
    detail = await _get_import(headers, import_id)
    job_id = detail["jobs"][0]["id"]

    sheet = b"RIFF____WEBPVP8 sheet-bytes"
    storage.objects[sprite_key(uuid.UUID(import_id), uuid.UUID(job_id))] = sheet

    async with get_test_client() as client:
        response = await client.get(
            f"/vision/imports/{import_id}/jobs/{job_id}/crops/sprite", headers=headers
        )

    assert response.status_code == 200
    assert response.headers["content-type"] == "image/webp"
    assert response.content == sheet


@pytest.mark.asyncio
async def test_sprite_bytes_forbidden_for_non_owner(fake_infra):
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
            f"/vision/imports/{import_id}/jobs/{job_id}/crops/sprite",
            headers=create_auth_headers(str(USER2_ID)),
        )

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_sprite_missing_object_is_404(fake_infra):
    await push_one_user()
    account = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
    headers = create_auth_headers(str(USER_ID))
    created = await _post_import(headers, account.id, [_png("a.png")])
    import_id = created.json()["id"]
    detail = await _get_import(headers, import_id)
    job_id = detail["jobs"][0]["id"]

    async with get_test_client() as client:
        response = await client.get(
            f"/vision/imports/{import_id}/jobs/{job_id}/crops/sprite", headers=headers
        )

    assert response.status_code == 404


async def _drive_job_done_with_prediction(job_id: str) -> None:
    """Drive a job to DONE with one prediction through the real service, exactly
    as the vision worker would report a successful read."""

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
                        crop_key="imports/a/b/crops/sprite_v1.webp#0",
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

    # Upload with the opt-in OFF: the choice is made in the review screen, so
    # it must ride the confirm — this is exactly the bug where checking the box
    # after upload archived nothing.
    created = await _post_import(headers, account.id, [_png("a.png")], share_dataset="false")
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
                "share_dataset": True,
                "rows": [
                    {
                        "champion_name": "Hulk",
                        "rarity": "7r3",
                        "signature": 200,
                        "ascension": 1,
                        "is_preferred_attacker": False,
                        "prediction_id": prediction_id,
                    }
                ],
            },
        )

    assert response.status_code == 200
    assert response.json()["samples_archived"] == 1
    assert len(storage.objects) == 2  # the uploaded screen + the archived sample

    after = await _get_import(headers, import_id)
    assert after["status"] == "confirmed"


@pytest.mark.asyncio
async def test_confirming_twice_is_idempotent(fake_infra):
    """A retry (network timeout, double-click) must not re-archive samples: the
    second confirm is a no-op, and only ONE sample object ever lands in storage."""
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

    confirm_body = {
        "share_dataset": True,
        "rows": [
            {
                "champion_name": "Hulk",
                "rarity": "7r3",
                "signature": 200,
                "ascension": 1,
                "is_preferred_attacker": False,
                "prediction_id": prediction_id,
            }
        ],
    }

    async with get_test_client() as client:
        first = await client.post(
            f"/vision/imports/{import_id}/confirm", headers=headers, json=confirm_body
        )

    assert first.status_code == 200
    assert first.json()["samples_archived"] == 1
    sample_keys_after_first = {key for key in storage.objects if key.startswith("samples/")}
    assert len(sample_keys_after_first) == 1

    async with get_test_client() as client:
        second = await client.post(
            f"/vision/imports/{import_id}/confirm", headers=headers, json=confirm_body
        )

    assert second.status_code == 200
    assert second.json()["samples_archived"] == 0
    sample_keys_after_second = {key for key in storage.objects if key.startswith("samples/")}
    # Still only the one sample object written by the first call.
    assert sample_keys_after_second == sample_keys_after_first


@pytest.mark.asyncio
async def test_confirm_archives_nothing_without_opt_in(fake_infra):
    storage, _ = fake_infra
    await push_one_user()
    account = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
    headers = create_auth_headers(str(USER_ID))

    # Upload opted IN, but the review screen opted back OUT: the confirm is
    # authoritative, so no sample is archived.
    created = await _post_import(headers, account.id, [_png("a.png")], share_dataset="true")
    import_id = created.json()["id"]
    detail = await _get_import(headers, import_id)
    job_id = detail["jobs"][0]["id"]
    await _drive_job_done_with_prediction(job_id)

    async with get_test_client() as client:
        response = await client.post(
            f"/vision/imports/{import_id}/confirm",
            headers=headers,
            json={
                "share_dataset": False,
                "rows": [
                    {
                        "champion_name": "Hulk",
                        "rarity": "7r3",
                        "signature": 200,
                        "ascension": 1,
                        "is_preferred_attacker": False,
                        "prediction_id": None,
                    }
                ],
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


async def _get_current(headers, game_account_id):
    async with get_test_client() as client:
        return await client.get(
            "/vision/imports/current",
            params={"game_account_id": str(game_account_id)},
            headers=headers,
        )


@pytest.mark.asyncio
async def test_current_returns_204_when_nothing_awaits(fake_infra):
    await push_one_user()
    account = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)

    response = await _get_current(create_auth_headers(str(USER_ID)), account.id)

    assert response.status_code == 204


@pytest.mark.asyncio
async def test_current_excludes_an_import_whose_images_expired(fake_infra):
    """Past the retention window the screenshots and crops are gone, so there is
    nothing left to check the predictions against."""

    await push_one_user()
    account = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
    headers = create_auth_headers(str(USER_ID))
    created = await _post_import(headers, account.id, [_png("a.png")])

    async for session in get_test_session():
        row = await session.get(VisionImport, uuid.UUID(created.json()["id"]))
        row.created_at = datetime.now(UTC) - timedelta(days=SECRET.VISION_RETENTION_DAYS + 1)
        session.add(row)
        await session.commit()
        break

    response = await _get_current(headers, account.id)

    assert response.status_code == 204


@pytest.mark.asyncio
async def test_current_returns_an_unconfirmed_done_import_with_predictions_count(fake_infra):
    await push_one_user()
    account = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
    headers = create_auth_headers(str(USER_ID))
    created = await _post_import(headers, account.id, [_png("a.png")])
    import_id = created.json()["id"]
    detail = await _get_import(headers, import_id)
    job_id = detail["jobs"][0]["id"]
    await _drive_job_done_with_prediction(job_id)

    response = await _get_current(headers, account.id)

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == import_id
    assert body["status"] == "done"
    assert body["predictions_count"] == 1


@pytest.mark.asyncio
async def test_current_excludes_a_confirmed_import(fake_infra):
    await push_one_user()
    account = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
    headers = create_auth_headers(str(USER_ID))
    created = await _post_import(headers, account.id, [_png("a.png")])
    import_id = created.json()["id"]
    detail = await _get_import(headers, import_id)
    job_id = detail["jobs"][0]["id"]
    await _drive_job_done_with_prediction(job_id)

    async with get_test_client() as client:
        confirmed = await client.post(
            f"/vision/imports/{import_id}/confirm", headers=headers, json={"rows": []}
        )
    assert confirmed.status_code == 200

    response = await _get_current(headers, account.id)

    assert response.status_code == 204


@pytest.mark.asyncio
async def test_current_excludes_a_cancelled_import(fake_infra):
    await push_one_user()
    account = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
    headers = create_auth_headers(str(USER_ID))
    created = await _post_import(headers, account.id, [_png("a.png")])
    import_id = created.json()["id"]

    async with get_test_client() as client:
        cancelled = await client.delete(f"/vision/imports/{import_id}", headers=headers)
    assert cancelled.status_code == 204

    response = await _get_current(headers, account.id)

    assert response.status_code == 204


@pytest.mark.asyncio
async def test_current_returns_the_most_recent_candidate(fake_infra):
    """Two simultaneous candidates can no longer be produced through the
    endpoint (the 409 guard forbids a second import while one is pending), so
    the second row is inserted directly. The two rows get distinct timestamps,
    so this covers the created_at ordering only — the id tie-break is covered
    by the test below."""

    await push_one_user()
    account = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
    headers = create_auth_headers(str(USER_ID))
    await _post_import(headers, account.id, [_png("a.png")])

    newest_id = uuid.uuid4()
    async for session in get_test_session():
        session.add(VisionImport(id=newest_id, game_account_id=account.id, screens_total=1))
        await session.commit()
        break

    response = await _get_current(headers, account.id)

    assert response.status_code == 200
    assert response.json()["id"] == str(newest_id)


@pytest.mark.asyncio
async def test_current_breaks_a_timestamp_tie_on_id(fake_infra):
    """Identical created_at is possible under a bulk insert, and without the id
    tie-break the winner would vary between requests. Both rows are inserted with
    the same timestamp so only the secondary sort can decide."""

    await push_one_user()
    account = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
    headers = create_auth_headers(str(USER_ID))

    same_moment = datetime.now(UTC)
    lower_id = uuid.UUID("00000000-0000-4000-8000-000000000001")
    higher_id = uuid.UUID("ffffffff-0000-4000-8000-000000000002")
    async for session in get_test_session():
        for row_id in (lower_id, higher_id):
            session.add(
                VisionImport(
                    id=row_id,
                    game_account_id=account.id,
                    screens_total=1,
                    created_at=same_moment,
                )
            )
        await session.commit()
        break

    response = await _get_current(headers, account.id)

    assert response.status_code == 200
    assert response.json()["id"] == str(higher_id)


@pytest.mark.asyncio
async def test_current_of_another_users_game_account_is_forbidden(fake_infra):
    await push_one_user()
    await push_user2()
    owner_account = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
    await push_game_account(user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)

    response = await _get_current(create_auth_headers(str(USER2_ID)), owner_account.id)

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


@pytest.mark.asyncio
async def test_second_import_while_one_is_pending_is_409(fake_infra):
    await push_one_user()
    account = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
    headers = create_auth_headers(str(USER_ID))
    first = await _post_import(headers, account.id, [_png("a.png")])

    second = await _post_import(headers, account.id, [_png("b.png")])

    assert second.status_code == 409
    # The blocking id must come back, so the UI can offer to cancel it instead
    # of just showing a wall.
    assert first.json()["id"] in second.text


async def _post_init(headers, game_account_id, filenames: list[str]):
    async with get_test_client() as client:
        return await client.post(
            "/vision/imports/init",
            headers=headers,
            json={
                "game_account_id": str(game_account_id),
                "share_dataset": False,
                "screens": [
                    {"filename": name, "content_type": "image/png", "size": len(PNG_BYTES)}
                    for name in filenames
                ],
            },
        )


async def _post_commit_screen(headers, import_id, job_id):
    async with get_test_client() as client:
        return await client.post(
            f"/vision/imports/{import_id}/screens/{job_id}/commit", headers=headers
        )


async def _post_commit(headers, import_id):
    async with get_test_client() as client:
        return await client.post(f"/vision/imports/{import_id}/commit", headers=headers)


def _screen_key(import_id: str, job_id: str) -> str:

    return screen_key(uuid.UUID(import_id), uuid.UUID(job_id))


@pytest.mark.asyncio
async def test_commit_screen_queues_one_screenshot_while_the_others_upload(fake_infra):
    """The reason the endpoint exists: the worker starts on screenshot 1 without
    waiting for screenshot 2 to finish climbing the user's uplink."""
    storage, publisher = fake_infra
    await push_one_user()
    account = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
    headers = create_auth_headers(str(USER_ID))
    init = await _post_init(headers, account.id, ["a.png", "b.png"])
    assert init.status_code == 201
    body = init.json()
    import_id, first = body["import_id"], body["uploads"][0]
    storage.browser_put(_screen_key(import_id, first["job_id"]))

    response = await _post_commit_screen(headers, import_id, first["job_id"])

    assert response.status_code == 200
    assert response.json()["status"] == "pending"
    assert [job["job_id"] for job in publisher.published] == [uuid.UUID(first["job_id"])]
    detail = await _get_import(headers, import_id)
    assert detail["status"] == "pending"
    assert sorted(job["status"] for job in detail["jobs"]) == ["awaiting_upload", "pending"]


@pytest.mark.asyncio
async def test_commit_screen_of_another_users_import_is_forbidden(fake_infra):
    storage, publisher = fake_infra
    await push_one_user()
    await push_user2()
    owner_account = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
    await push_game_account(user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)
    init = await _post_init(create_auth_headers(str(USER_ID)), owner_account.id, ["a.png"])
    body = init.json()
    import_id, job_id = body["import_id"], body["uploads"][0]["job_id"]
    storage.browser_put(_screen_key(import_id, job_id))

    response = await _post_commit_screen(create_auth_headers(str(USER2_ID)), import_id, job_id)

    assert response.status_code == 403
    assert publisher.published == []


@pytest.mark.asyncio
async def test_commit_seals_the_batch_and_fails_the_screenshot_that_never_uploaded(fake_infra):
    """One PUT died. The screenshot that did upload is already running and cannot
    be recalled, so the import completes around the hole instead of refusing."""
    storage, publisher = fake_infra
    await push_one_user()
    account = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
    headers = create_auth_headers(str(USER_ID))
    body = (await _post_init(headers, account.id, ["ok.png", "lost.png"])).json()
    import_id, uploaded, lost = body["import_id"], body["uploads"][0], body["uploads"][1]
    storage.browser_put(_screen_key(import_id, uploaded["job_id"]))
    await _post_commit_screen(headers, import_id, uploaded["job_id"])

    response = await _post_commit(headers, import_id)

    assert response.status_code == 200
    assert response.json()["screens_done"] == 1
    detail = await _get_import(headers, import_id)
    statuses = {job["id"]: job["status"] for job in detail["jobs"]}
    assert statuses[uploaded["job_id"]] == "pending"
    assert statuses[lost["job_id"]] == "failed"
    # Only the screenshot that actually arrived was ever queued.
    assert [job["job_id"] for job in publisher.published] == [uuid.UUID(uploaded["job_id"])]


@pytest.mark.asyncio
async def test_commit_does_not_requeue_screenshots_already_queued_one_by_one(fake_infra):
    """The normal path leaves the seal nothing to do. Re-publishing here would
    run the whole roster through the worker twice and double every prediction."""
    storage, publisher = fake_infra
    await push_one_user()
    account = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
    headers = create_auth_headers(str(USER_ID))
    body = (await _post_init(headers, account.id, ["a.png", "b.png"])).json()
    import_id = body["import_id"]
    for upload in body["uploads"]:
        storage.browser_put(_screen_key(import_id, upload["job_id"]))
        await _post_commit_screen(headers, import_id, upload["job_id"])

    response = await _post_commit(headers, import_id)

    assert response.status_code == 200
    assert len(publisher.published) == 2


@pytest.mark.asyncio
async def test_current_ignores_an_import_stuck_mid_upload_past_the_url_ttl(fake_infra):
    """The tab closed after the first screenshot was queued. Its result moved the
    import to RUNNING, but the second screenshot can never be uploaded now that
    the URLs are dead, so the import can never finish. Left blocking, it would
    lock the game account out of importing for the whole retention window."""

    storage, _ = fake_infra
    await push_one_user()
    account = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
    headers = create_auth_headers(str(USER_ID))
    body = (await _post_init(headers, account.id, ["a.png", "b.png"])).json()
    import_id, first = body["import_id"], body["uploads"][0]
    storage.browser_put(_screen_key(import_id, first["job_id"]))
    await _post_commit_screen(headers, import_id, first["job_id"])
    await _drive_job_done_with_prediction(first["job_id"])

    async for session in get_test_session():
        row = await session.get(VisionImport, uuid.UUID(import_id))
        assert row.status.value == "running"
        row.created_at = datetime.now(UTC) - timedelta(seconds=UPLOAD_URL_TTL_SECONDS + 60)
        session.add(row)
        await session.commit()
        break

    response = await _get_current(headers, account.id)

    assert response.status_code == 204


@pytest.mark.asyncio
async def test_current_still_returns_an_import_whose_uploads_are_in_flight(fake_infra):
    """The mirror of the test above: while the URLs are alive the import is very
    much the user's business, and a second import must stay refused."""
    storage, _ = fake_infra
    await push_one_user()
    account = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
    headers = create_auth_headers(str(USER_ID))
    body = (await _post_init(headers, account.id, ["a.png", "b.png"])).json()
    import_id, first = body["import_id"], body["uploads"][0]
    storage.browser_put(_screen_key(import_id, first["job_id"]))
    await _post_commit_screen(headers, import_id, first["job_id"])

    response = await _get_current(headers, account.id)

    assert response.status_code == 200
    assert response.json()["id"] == import_id


@pytest.mark.asyncio
async def test_eleventh_import_in_an_hour_is_429(fake_infra):
    await push_one_user()
    account = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
    headers = create_auth_headers(str(USER_ID))
    # Cancel each one so the 409 rule never fires — only the quota should.
    for _ in range(10):
        created = await _post_import(headers, account.id, [_png("a.png")])
        async with get_test_client() as client:
            await client.delete(f"/vision/imports/{created.json()['id']}", headers=headers)

    eleventh = await _post_import(headers, account.id, [_png("a.png")])

    assert eleventh.status_code == 429

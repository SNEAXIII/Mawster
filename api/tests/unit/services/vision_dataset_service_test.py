import json
import uuid

import pytest

from src.enums.AttackPreference import AttackPreference
from src.models.vision.VisionImport import VisionImport
from src.models.vision.VisionJob import VisionJob
from src.models.vision.VisionPrediction import VisionPrediction
from src.services.account.game.VisionDatasetService import ConfirmedRow, VisionDatasetService


class FakeStorage:
    def __init__(self):
        self.puts: dict[str, bytes] = {}
        self.copies: list[tuple[str, str, str, str]] = []

    async def put_bytes(self, bucket, key, data, content_type) -> None:
        self.puts[key] = data

    async def copy_object(self, src_bucket, src_key, dst_bucket, dst_key) -> None:
        self.copies.append((src_bucket, src_key, dst_bucket, dst_key))


class FakeSession:
    """get() resolves objects seeded ahead of time by (type, id) — enough to
    stand in for the prediction/job lookups archive() performs."""

    def __init__(self):
        self._store: dict[tuple[type, uuid.UUID], object] = {}

    def seed(self, obj) -> None:
        self._store[(type(obj), obj.id)] = obj

    async def get(self, model, obj_id):
        return self._store.get((model, obj_id))


def _import(share=True) -> VisionImport:
    imp = VisionImport(game_account_id=uuid.uuid4(), screens_total=1, screens_done=1)
    imp.share_dataset = share
    return imp


@pytest.mark.asyncio
async def test_archive_writes_a_sample_per_row_when_opted_in():
    session, storage = FakeSession(), FakeStorage()
    job = VisionJob(import_id=uuid.uuid4(), object_key="imports/x/y/screen.png")
    prediction = VisionPrediction(
        job_id=job.id,
        champion_name="Hulk",
        champion_class="Science",
        stars=7,
        rank=3,
        signature=150,
        ascension=0,
        confidence=0.8,
        preview_left=0.1,
        preview_right=0.3,
        preview_top=0.05,
        preview_bottom=0.4,
    )
    session.seed(job)
    session.seed(prediction)
    rows = [
        ConfirmedRow(
            champion_name="Hulk",
            rarity="7r3",
            signature=200,
            ascension=1,
            attack_preference=AttackPreference.NEUTRAL,
            prediction_id=prediction.id,
        )
    ]

    imp = _import(share=True)
    count = await VisionDatasetService.archive(session, storage, imp, rows + rows)

    assert count == 2
    screen = f"samples/{imp.id}/{job.id}.png"
    # Two rows from the same screenshot copy it once.
    assert storage.copies == [("vision", job.object_key, "dataset", screen)]
    assert sorted(storage.puts) == [f"samples/{imp.id}/0.json", f"samples/{imp.id}/1.json"]
    payload = json.loads(storage.puts[f"samples/{imp.id}/0.json"])
    assert payload["screen_key"] == screen
    assert payload["prediction"]["champion_name"] == "Hulk"
    assert payload["prediction"]["confidence"] == 0.8
    assert payload["prediction"]["preview"] == {
        "left": 0.1,
        "right": 0.3,
        "top": 0.05,
        "bottom": 0.4,
    }
    assert payload["truth"] == {
        "champion_name": "Hulk",
        "rarity": "7r3",
        "signature": 200,
        "ascension": 1,
        "attack_preference": "neutral",
    }


def test_payload_has_a_null_preview_for_a_prediction_without_one():
    prediction = VisionPrediction(job_id=uuid.uuid4())

    assert VisionDatasetService._prediction_payload(prediction)["preview"] is None


@pytest.mark.asyncio
async def test_archive_stores_a_null_prediction_for_user_added_rows():
    session, storage = FakeSession(), FakeStorage()
    rows = [
        ConfirmedRow(
            champion_name="Groot",
            rarity="6r2",
            signature=0,
            ascension=0,
            attack_preference=AttackPreference.PREFERRED,
            prediction_id=None,
        )
    ]

    imp = _import(share=True)
    count = await VisionDatasetService.archive(session, storage, imp, rows)

    assert count == 1
    assert storage.copies == []
    payload = json.loads(storage.puts[f"samples/{imp.id}/0.json"])
    assert payload["prediction"] is None
    assert payload["screen_key"] == ""
    assert payload["truth"]["champion_name"] == "Groot"


@pytest.mark.asyncio
async def test_archive_is_a_noop_without_opt_in():
    session, storage = FakeSession(), FakeStorage()
    rows = [
        ConfirmedRow(
            champion_name="Hulk",
            rarity="7r3",
            signature=200,
            ascension=1,
            attack_preference=AttackPreference.NEUTRAL,
            prediction_id=None,
        )
    ]

    count = await VisionDatasetService.archive(session, storage, _import(share=False), rows)

    assert count == 0
    assert storage.puts == {}
    assert storage.copies == []

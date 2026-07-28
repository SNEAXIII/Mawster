import json
import uuid

import pytest

from src.models.VisionImport import VisionImport
from src.models.VisionJob import VisionJob
from src.models.VisionPrediction import VisionPrediction
from src.services.account.game.VisionDatasetService import ConfirmedRow, VisionDatasetService


class FakeStorage:
    def __init__(self):
        self.puts: dict[str, bytes] = {}

    async def put_bytes(self, bucket, key, data, content_type) -> None:
        self.puts[key] = data


class FakeSession:
    """Minimal async session: records adds, commits are no-ops, and get()
    resolves objects seeded ahead of time by (type, id) — enough to stand in
    for the prediction/job lookups archive() performs."""

    def __init__(self):
        self.added: list = []
        self._store: dict[tuple[type, uuid.UUID], object] = {}

    def seed(self, obj) -> None:
        self._store[(type(obj), obj.id)] = obj

    def add(self, obj) -> None:
        self.added.append(obj)

    async def get(self, model, id):
        return self._store.get((model, id))

    async def commit(self):
        pass


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
        crop_key="imports/x/y/crops/0.png",
    )
    session.seed(job)
    session.seed(prediction)
    rows = [
        ConfirmedRow(
            champion_name="Hulk",
            rarity="7r3",
            signature=200,
            ascension=1,
            is_preferred_attacker=False,
            prediction_id=prediction.id,
        )
    ]

    count = await VisionDatasetService.archive(session, storage, _import(share=True), rows)

    assert count == 1
    samples = [o for o in session.added if o.__class__.__name__ == "VisionSample"]
    assert len(samples) == 1
    sample = samples[0]
    assert sample.screen_key == job.object_key
    assert sample.dataset_key == f"samples/{sample.id}/sample.json"

    assert list(storage.puts.keys()) == [sample.dataset_key]
    payload = json.loads(storage.puts[sample.dataset_key])
    assert payload["screen_key"] == job.object_key
    assert payload["prediction"]["champion_name"] == "Hulk"
    assert payload["prediction"]["confidence"] == 0.8
    assert payload["prediction"]["crop_key"] == "imports/x/y/crops/0.png"
    assert payload["truth"] == {
        "champion_name": "Hulk",
        "rarity": "7r3",
        "signature": 200,
        "ascension": 1,
        "is_preferred_attacker": False,
    }


@pytest.mark.asyncio
async def test_archive_stores_a_null_prediction_for_user_added_rows():
    session, storage = FakeSession(), FakeStorage()
    rows = [
        ConfirmedRow(
            champion_name="Groot",
            rarity="6r2",
            signature=0,
            ascension=0,
            is_preferred_attacker=True,
            prediction_id=None,
        )
    ]

    count = await VisionDatasetService.archive(session, storage, _import(share=True), rows)

    assert count == 1
    sample = next(o for o in session.added if o.__class__.__name__ == "VisionSample")
    assert sample.screen_key == ""

    payload = json.loads(storage.puts[sample.dataset_key])
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
            is_preferred_attacker=False,
            prediction_id=None,
        )
    ]

    count = await VisionDatasetService.archive(session, storage, _import(share=False), rows)

    assert count == 0
    assert session.added == []
    assert storage.puts == {}

import uuid

import pytest
import pytest_asyncio
from sqlmodel import select

from src.models.VisionImport import VisionImport, VisionImportStatus
from src.models.VisionJob import VisionJob, VisionJobStatus
from src.models.VisionPrediction import VisionPrediction
from tests.utils.utils_db import Session, reset_test_db


@pytest_asyncio.fixture
async def session():
    """Real async DB session backed by the project's SQLite test engine.

    Needed here (and not just a FakeSession) because the ordering guarantee
    that `position` provides can only be proven by round-tripping through an
    actual database — an in-memory list proves nothing about row order.
    """
    reset_test_db()
    async with Session() as session:
        yield session


def test_vision_import_defaults():
    vision_import = VisionImport(game_account_id=uuid.uuid4(), screens_total=3)
    assert vision_import.status == VisionImportStatus.PENDING
    assert vision_import.screens_done == 0
    assert vision_import.share_dataset is False


def test_vision_job_defaults():
    job = VisionJob(import_id=uuid.uuid4(), object_key="imports/a/b/screen.png")
    assert job.status == VisionJobStatus.PENDING
    assert job.attempts == 0
    assert job.result_key is None
    assert job.error is None


def test_vision_prediction_accepts_out_of_range_values():
    """A prediction is a model reading, not a validated roster entry: a bad OCR
    result must be storable so the user can fix it in the review screen."""
    prediction = VisionPrediction(
        job_id=uuid.uuid4(),
        champion_name="Hulk",
        stars=2,
        rank=9,
        signature=999,
        ascension=7,
        confidence=0.12,
    )
    assert prediction.stars == 2
    assert prediction.rank == 9


def test_vision_prediction_accepts_unknown_champion():
    """CLIP can fail to recognise a champion. That row must still be storable —
    it is the most valuable dataset sample there is."""
    prediction = VisionPrediction(
        job_id=uuid.uuid4(),
        champion_name=None,
        champion_class=None,
        stars=7,
        rank=3,
        signature=0,
        ascension=0,
        confidence=0.11,
    )
    assert prediction.champion_name is None
    assert prediction.champion_class is None


def test_vision_sample_construction():
    from src.models.VisionSample import VisionSample

    sample = VisionSample(
        import_id=uuid.uuid4(),
        game_account_id=uuid.uuid4(),
        screen_key="imports/a/b/screen.png",
    )
    assert sample.dataset_key is None
    assert sample.screen_key.endswith("screen.png")


def test_vision_import_has_confirmed_status():
    from src.models.VisionImport import VisionImportStatus

    assert VisionImportStatus.CONFIRMED.value == "confirmed"


def test_vision_import_has_cancelled_status():
    from src.models.VisionImport import VisionImportStatus

    assert VisionImportStatus.CANCELLED.value == "cancelled"


def test_candidate_carries_its_rank():
    from src.models.VisionPredictionCandidate import VisionPredictionCandidate

    candidate = VisionPredictionCandidate(
        prediction_id=uuid.uuid4(), name="Gorr", score=0.78, position=1
    )

    assert candidate.name == "Gorr"
    assert candidate.score == 0.78
    assert candidate.position == 1


def test_vision_prediction_candidates_default_to_empty():
    from src.models.VisionPrediction import VisionPrediction

    pred = VisionPrediction(job_id=uuid.uuid4())
    assert pred.candidates == []


@pytest.mark.asyncio
async def test_candidates_come_back_best_first(session):
    from src.models.VisionPredictionCandidate import VisionPredictionCandidate

    pred = VisionPrediction(job_id=uuid.uuid4(), champion_name="Gladiator")
    session.add(pred)
    await session.commit()

    # Inserted worst-first on purpose: if the ordering were left to the
    # database, this is the case that would come back wrong.
    session.add(
        VisionPredictionCandidate(prediction_id=pred.id, name="Gorr", score=0.78, position=1)
    )
    session.add(
        VisionPredictionCandidate(prediction_id=pred.id, name="Gladiator", score=0.79, position=0)
    )
    await session.commit()

    stored = (
        await session.exec(
            select(VisionPredictionCandidate)
            .where(VisionPredictionCandidate.prediction_id == pred.id)
            .order_by(VisionPredictionCandidate.position)
        )
    ).all()

    assert [c.name for c in stored] == ["Gladiator", "Gorr"]

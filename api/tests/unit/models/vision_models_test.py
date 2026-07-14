import uuid

from src.models.VisionImport import VisionImport, VisionImportStatus
from src.models.VisionJob import VisionJob, VisionJobStatus
from src.models.VisionPrediction import VisionPrediction


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

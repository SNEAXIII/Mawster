import json
import logging
import uuid

from pydantic import BaseModel

from src.dto.account.game.dto_vision_predictions import VisionPreview
from src.enums.AttackPreference import AttackPreference
from src.models.vision.VisionImport import VisionImport
from src.models.vision.VisionJob import VisionJob
from src.models.vision.VisionPrediction import VisionPrediction
from src.security.secrets import SECRET
from src.storage.base import Storage
from src.utils.db import SessionDep

logger = logging.getLogger(__name__)


class ConfirmedRow(BaseModel):
    """One row as the user confirmed it in the review screen."""

    champion_name: str
    rarity: str
    signature: int = 0
    ascension: int = 0
    attack_preference: AttackPreference = AttackPreference.NEUTRAL
    # Links the confirmed row back to the prediction it corrected, so the dataset
    # sample can pair prediction and truth. None if the user added the row.
    prediction_id: uuid.UUID | None = None


class VisionDatasetService:
    """Archives opt-in dataset samples on import confirmation.

    A sample pairs what the model read (the prediction) with what the user
    confirmed (the truth), next to a copy of the screenshot it came from — the
    original in `imports/` expires after VISION_RETENTION_DAYS. Everything lives
    under `samples/{import_id}/` in the `dataset` bucket, which expires on its own;
    `VisionImport.share_dataset` is the consent record.
    """

    @classmethod
    async def archive(
        cls,
        session: SessionDep,
        storage: Storage,
        vision_import: VisionImport,
        rows: list[ConfirmedRow],
    ) -> int:
        if not vision_import.share_dataset:
            return 0

        prefix = f"samples/{vision_import.id}/"
        copied: dict[uuid.UUID, str] = {}
        for index, row in enumerate(rows):
            prediction, job = await cls._resolve_prediction(session, row.prediction_id)
            screen_key = ""
            if job is not None:
                screen_key = copied.get(job.id, "")
                if not screen_key:
                    screen_key = f"{prefix}{job.id}.png"
                    await storage.copy_object(
                        SECRET.RUSTFS_BUCKET_VISION,
                        job.object_key,
                        SECRET.RUSTFS_BUCKET_DATASET,
                        screen_key,
                    )
                    copied[job.id] = screen_key
            payload = {
                "prediction": cls._prediction_payload(prediction),
                "truth": {
                    "champion_name": row.champion_name,
                    "rarity": row.rarity,
                    "signature": row.signature,
                    "ascension": row.ascension,
                    "attack_preference": row.attack_preference.value,
                },
                "screen_key": screen_key,
            }
            await storage.put_bytes(
                SECRET.RUSTFS_BUCKET_DATASET,
                f"{prefix}{index}.json",
                json.dumps(payload).encode(),
                "application/json",
            )

        if rows:
            logger.info("archived %s dataset sample(s) for import %s", len(rows), vision_import.id)
        return len(rows)

    @classmethod
    async def _resolve_prediction(
        cls, session: SessionDep, prediction_id: uuid.UUID | None
    ) -> tuple[VisionPrediction | None, VisionJob | None]:
        """The prediction a row corrected and the job of its screenshot, or
        (None, None) for a row the user added by hand."""
        if prediction_id is None:
            return None, None
        prediction = await session.get(VisionPrediction, prediction_id)
        if prediction is None:
            return None, None
        return prediction, await session.get(VisionJob, prediction.job_id)

    @staticmethod
    def _prediction_payload(prediction: VisionPrediction | None) -> dict | None:
        if prediction is None:
            return None
        preview = VisionPreview.from_prediction(prediction)
        return {
            "champion_name": prediction.champion_name,
            "champion_class": prediction.champion_class,
            "stars": prediction.stars,
            "rank": prediction.rank,
            "signature": prediction.signature,
            "ascension": prediction.ascension,
            "confidence": prediction.confidence,
            "preview": preview.model_dump() if preview else None,
        }

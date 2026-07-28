import json
import logging
import uuid

from pydantic import BaseModel

from src.models.VisionImport import VisionImport
from src.models.VisionJob import VisionJob
from src.models.VisionPrediction import VisionPrediction
from src.models.VisionSample import VisionSample
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
    is_preferred_attacker: bool = False
    # Links the confirmed row back to the prediction it corrected, so the dataset
    # sample can pair prediction and truth. None if the user added the row.
    prediction_id: uuid.UUID | None = None


class VisionDatasetService:
    """Archives opt-in dataset samples on import confirmation.

    A sample is the pairing of what the model read (the prediction) with what
    the user confirmed (the truth) — that pairing is the entire training
    signal, so it is stored together as one JSON object. Only the object key
    is kept in the DB (VisionSample.dataset_key); the JSON itself lives in the
    `dataset` bucket, and only when the import opted in.
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

        count = 0
        for row in rows:
            prediction, screen_key = await cls._resolve_prediction(session, row.prediction_id)

            sample = VisionSample(
                import_id=vision_import.id,
                game_account_id=vision_import.game_account_id,
                screen_key=screen_key,
            )
            payload = {
                "prediction": cls._prediction_payload(prediction),
                "truth": {
                    "champion_name": row.champion_name,
                    "rarity": row.rarity,
                    "signature": row.signature,
                    "ascension": row.ascension,
                    "is_preferred_attacker": row.is_preferred_attacker,
                },
                "screen_key": screen_key,
            }
            key = f"samples/{sample.id}/sample.json"
            await storage.put_bytes(
                SECRET.RUSTFS_BUCKET_DATASET,
                key,
                json.dumps(payload).encode(),
                "application/json",
            )
            sample.dataset_key = key
            session.add(sample)
            count += 1

        await session.commit()
        if count:
            logger.info("archived %s dataset sample(s) for import %s", count, vision_import.id)
        return count

    @classmethod
    async def _resolve_prediction(
        cls, session: SessionDep, prediction_id: uuid.UUID | None
    ) -> tuple[VisionPrediction | None, str]:
        """Look up the prediction a row corrected, and the screen it came from.

        Returns (None, "") when the row has no prediction (the user added it
        manually) or the prediction can no longer be resolved.
        """
        if prediction_id is None:
            return None, ""
        prediction = await session.get(VisionPrediction, prediction_id)
        if prediction is None:
            return None, ""
        job = await session.get(VisionJob, prediction.job_id)
        screen_key = job.object_key if job is not None else ""
        return prediction, screen_key

    @staticmethod
    def _prediction_payload(prediction: VisionPrediction | None) -> dict | None:
        if prediction is None:
            return None
        return {
            "champion_name": prediction.champion_name,
            "champion_class": prediction.champion_class,
            "stars": prediction.stars,
            "rank": prediction.rank,
            "signature": prediction.signature,
            "ascension": prediction.ascension,
            "confidence": prediction.confidence,
            "crop_key": prediction.crop_key,
        }

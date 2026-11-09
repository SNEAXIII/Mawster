import uuid

from sqlmodel import col, select

from src.enums.VisionCorrectionKind import VisionCorrectionKind
from src.models.vision.VisionCorrection import VisionCorrection
from src.models.vision.VisionImport import VisionImport
from src.models.vision.VisionJob import VisionJob
from src.models.vision.VisionPrediction import VisionPrediction
from src.services.account.game.VisionDatasetService import ConfirmedRow
from src.utils.db import SessionDep


def _predicted_fields(prediction: VisionPrediction) -> dict[str, str | None]:
    return {
        "champion_name": prediction.champion_name,
        "rarity": f"{prediction.stars}r{prediction.rank}",
        "signature": str(prediction.signature),
        "ascension": str(prediction.ascension),
    }


def _confirmed_fields(row: ConfirmedRow) -> dict[str, str | None]:
    return {
        "champion_name": row.champion_name,
        "rarity": row.rarity,
        "signature": str(row.signature),
        "ascension": str(row.ascension),
    }


class VisionCorrectionService:
    """Logs what the user changed between the model's reading and the confirmed rows."""

    @classmethod
    async def record(
        cls, session: SessionDep, vision_import: VisionImport, rows: list[ConfirmedRow]
    ) -> list[VisionCorrection]:
        """Stage one row per change on the session; the caller commits.

        A `prediction_id` outside this import counts as a hand-added card: the
        client sent it, so it is never trusted to point at someone else's reading.
        """
        predictions = (
            await session.exec(
                select(VisionPrediction)
                .join(VisionJob, col(VisionJob.id) == col(VisionPrediction.job_id))
                .where(col(VisionJob.import_id) == vision_import.id)
            )
        ).all()
        by_id = {prediction.id: prediction for prediction in predictions}

        corrections: list[VisionCorrection] = []
        kept: set[uuid.UUID] = set()
        for row in rows:
            prediction = by_id.get(row.prediction_id) if row.prediction_id else None
            if prediction is None:
                corrections.append(
                    VisionCorrection(
                        import_id=vision_import.id,
                        kind=VisionCorrectionKind.ADDED,
                        corrected=row.champion_name,
                    )
                )
                continue
            kept.add(prediction.id)
            predicted = _predicted_fields(prediction)
            for field, confirmed in _confirmed_fields(row).items():
                if predicted[field] != confirmed:
                    corrections.append(
                        VisionCorrection(
                            import_id=vision_import.id,
                            prediction_id=prediction.id,
                            kind=VisionCorrectionKind.EDITED,
                            field=field,
                            predicted=predicted[field],
                            corrected=confirmed,
                        )
                    )

        corrections.extend(
            VisionCorrection(
                import_id=vision_import.id,
                prediction_id=prediction.id,
                kind=VisionCorrectionKind.REMOVED,
                predicted=prediction.champion_name,
            )
            for prediction in predictions
            if prediction.id not in kept
        )

        session.add_all(corrections)
        return corrections

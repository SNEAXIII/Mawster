import uuid
from typing import TYPE_CHECKING

from pydantic import BaseModel

if TYPE_CHECKING:
    from src.models.vision.VisionPrediction import VisionPrediction


class VisionPreview(BaseModel):
    """Where a card sits in its screenshot, the area the review row cuts out.

    All four are in screenshot pixels, as the detector gives them.
    """

    left: float
    right: float
    top: float
    bottom: float

    @classmethod
    def from_prediction(cls, prediction: VisionPrediction) -> VisionPreview | None:
        # `is None`: 0.0 is a real left, a card touching the screenshot's edge.
        if prediction.preview_left is None:
            return None
        return cls(
            left=prediction.preview_left,
            right=prediction.preview_right,
            top=prediction.preview_top,
            bottom=prediction.preview_bottom,
        )


class VisionPredictionResponse(BaseModel):
    """One staged champion read from a screenshot, for the review screen."""

    id: uuid.UUID
    job_id: uuid.UUID
    champion_name: str | None = None
    champion_class: str | None = None
    stars: int = 0
    rank: int = 0
    signature: int = 0
    ascension: int = 0
    confidence: float = 0.0
    # None from a worker that sends no preview: the front shows the portrait.
    preview: VisionPreview | None = None
    # Index of the job (screenshot) within the import, for grouping in the UI.
    job_index: int


class VisionPredictionsResponse(BaseModel):
    import_id: uuid.UUID
    predictions: list[VisionPredictionResponse] = []
    # Presigned screenshot URL per DONE job, the source each preview is cut from.
    screens: dict[uuid.UUID, str] = {}

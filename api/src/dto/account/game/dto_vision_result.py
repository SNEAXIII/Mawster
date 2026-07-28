import uuid
from typing import Literal

from pydantic import BaseModel


class VisionCandidate(BaseModel):
    """One CLIP guess and its cosine similarity.

    The list of these is what makes the top1-top2 margin computable. The margin
    is the real confidence signal: the absolute score says almost nothing.
    """

    name: str
    score: float = 0.0


class VisionPredictionMessage(BaseModel):
    """One champion the worker read from a screenshot.

    Cross-repo contract: produced by mcoc-vision's worker, consumed here. The
    field names are the mapping of mcoc-vision's CardResult — `sig` becomes
    `signature`, `name_score` becomes `confidence`, and `awakened` is dropped
    (the roster has no such column; it is implied by signature > 0).
    """

    champion_name: str | None = None
    champion_class: str | None = None
    stars: int = 0
    rank: int = 0
    signature: int = 0
    ascension: int = 0
    confidence: float = 0.0
    crop_key: str | None = None
    # Best first. Empty from a worker that predates this field, or when the
    # portrait crop failed and no naming ran — both are valid, not errors.
    candidates: list[VisionCandidate] = []


class VisionResultMessage(BaseModel):
    """What the worker publishes on `vision.results` for one screenshot."""

    job_id: uuid.UUID
    import_id: uuid.UUID
    status: Literal["done", "failed"]
    error: str | None = None
    result_key: str | None = None
    predictions: list[VisionPredictionMessage] = []

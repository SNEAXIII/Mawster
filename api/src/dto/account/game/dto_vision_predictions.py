import uuid

from pydantic import BaseModel


class VisionCandidateResponse(BaseModel):
    """One alternative the model considered, offered to the user in one click."""

    name: str
    score: float = 0.0


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
    # Index of the crop within its job (imports/.../{job}/crops/{index}.png). None
    # when the detector produced no thumbnail for this card (degenerate box).
    crop_index: int | None = None
    # Index of the job (screenshot) within the import, for grouping in the UI.
    job_index: int
    # Best first, top-1 included. Empty when the worker sent none.
    candidates: list[VisionCandidateResponse] = []
    # score[0] - score[1]. None when there are fewer than two candidates — the UI
    # treats that as "needs a look", not as "confident". Derived on read, never
    # stored: a persisted derivative can drift from what it was derived from.
    margin: float | None = None


class VisionPredictionsResponse(BaseModel):
    import_id: uuid.UUID
    predictions: list[VisionPredictionResponse] = []

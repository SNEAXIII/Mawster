"""Admin-side aggregates over the AI (vision) roster imports.

These DTOs answer three questions an admin actually asks about the feature:
how much is it used, who uses it, and is the model doing a good job. Nothing
here is user-facing — every field is an aggregate the owner of the data could
not see about anyone else.
"""

import uuid
from datetime import date, datetime

from pydantic import BaseModel

from src.dto.mixins import PlayerIdentity


class VisionStatsOverview(BaseModel):
    """Headline counters for one time window."""

    imports_total: int = 0
    imports_confirmed: int = 0
    imports_cancelled: int = 0
    imports_failed: int = 0
    # Anything still in flight: awaiting_upload / pending / running / done-but-
    # not-yet-confirmed. Grouped because the distinction only matters live.
    imports_in_progress: int = 0
    imports_all_time: int = 0

    screens_total: int = 0
    jobs_total: int = 0
    jobs_failed: int = 0
    predictions_total: int = 0

    distinct_users: int = 0
    distinct_game_accounts: int = 0

    # Confidence is the best candidate's naming score; the margin its lead over
    # the second best — a low margin is a card the model could have named either way.
    avg_confidence: float | None = None
    min_confidence: float | None = None
    avg_import_min_confidence: float | None = None
    # Over the whole base, whatever the window: see low_confidence_threshold().
    low_confidence_threshold: float | None = None
    low_confidence_predictions: int = 0
    avg_margin: float | None = None

    avg_screens_per_import: float = 0.0


class VisionStatsDailyPoint(BaseModel):
    day: date
    imports: int = 0
    screens: int = 0
    confirmed: int = 0


class VisionJobErrorStat(BaseModel):
    error: str
    count: int


class VisionStatsResponse(BaseModel):
    days: int
    overview: VisionStatsOverview
    daily: list[VisionStatsDailyPoint]
    top_errors: list[VisionJobErrorStat]


class VisionUserStat(BaseModel):
    user_id: uuid.UUID
    login: str
    role: str
    game_pseudos: list[str] = []

    imports_total: int = 0
    imports_confirmed: int = 0
    imports_cancelled: int = 0
    imports_failed: int = 0
    screens_total: int = 0
    predictions_total: int = 0
    shared_dataset_imports: int = 0
    confirm_rate: float = 0.0

    first_import_at: datetime | None = None
    last_import_at: datetime | None = None


class PaginatedVisionUserStats(BaseModel):
    items: list[VisionUserStat]
    total: int
    page: int
    size: int
    pages: int


class VisionImportRow(PlayerIdentity):
    id: uuid.UUID
    created_at: datetime
    status: str
    user_id: uuid.UUID
    login: str
    screens_total: int = 0
    screens_done: int = 0
    jobs_failed: int = 0
    predictions_total: int = 0
    min_confidence: float | None = None
    avg_confidence: float | None = None
    low_confidence_predictions: int = 0
    share_dataset: bool = False


class PaginatedVisionImports(BaseModel):
    items: list[VisionImportRow]
    total: int
    page: int
    size: int
    pages: int

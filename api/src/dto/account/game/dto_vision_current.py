import uuid
from datetime import datetime

from pydantic import BaseModel


class CurrentVisionImportResponse(BaseModel):
    """The one import that currently needs the user's attention, if any."""

    id: uuid.UUID
    status: str
    screens_total: int
    screens_done: int
    created_at: datetime
    # Lets the banner say "16 champions read" without a second round-trip.
    predictions_count: int

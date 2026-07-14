import uuid
from typing import Optional, TYPE_CHECKING

from sqlmodel import Field, Relationship

from src.models.Base import UUIDBase

if TYPE_CHECKING:
    from src.models.VisionJob import VisionJob


class VisionPrediction(UUIDBase, table=True):
    """One champion read from a screenshot — staging, not roster truth.

    The numeric fields are deliberately unconstrained: they hold what the model
    read, which may be wrong. Bounds are enforced when the user confirms the
    import and a real ChampionUser is written.
    """

    __tablename__ = "vision_prediction"

    job_id: uuid.UUID = Field(foreign_key="vision_job.id")
    champion_name: str = Field(max_length=100)
    stars: int = 0
    rank: int = 0
    signature: int = 0
    ascension: int = 0
    confidence: float = Field(default=0.0)
    crop_key: Optional[str] = Field(default=None, max_length=255)

    job: "VisionJob" = Relationship(back_populates="predictions")

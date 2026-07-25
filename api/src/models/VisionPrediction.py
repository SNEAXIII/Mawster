import uuid
from typing import TYPE_CHECKING

from sqlmodel import Field, Relationship

from src.models.Base import UUIDBase

if TYPE_CHECKING:
    from src.models.VisionJob import VisionJob
    from src.models.VisionPredictionCandidate import VisionPredictionCandidate


class VisionPrediction(UUIDBase, table=True):
    """One champion read from a screenshot — staging, not roster truth.

    The numeric fields are deliberately unconstrained: they hold what the model
    read, which may be wrong. Bounds are enforced when the user confirms the
    import and a real ChampionUser is written.

    champion_name is nullable: CLIP can fail to recognise a champion. That row
    still matters — the user fixes it in the review screen, and the correction is
    the most valuable ground truth we can collect.
    """

    __tablename__ = "vision_prediction"

    job_id: uuid.UUID = Field(foreign_key="vision_job.id")
    champion_name: str | None = Field(default=None, max_length=100)
    champion_class: str | None = Field(default=None, max_length=50)
    stars: int = 0
    rank: int = 0
    signature: int = 0
    ascension: int = 0
    confidence: float = Field(default=0.0)
    crop_key: str | None = Field(default=None, max_length=255)

    job: "VisionJob" = Relationship(back_populates="predictions")
    candidates: list["VisionPredictionCandidate"] = Relationship(
        back_populates="prediction",
        sa_relationship_kwargs={"order_by": "VisionPredictionCandidate.position"},
    )

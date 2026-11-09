import uuid
from typing import TYPE_CHECKING

from sqlmodel import Field, Relationship

from src.models.Base import FK_VISION_JOB, UUIDBase

if TYPE_CHECKING:
    from src.models.vision.VisionJob import VisionJob


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

    job_id: uuid.UUID = Field(foreign_key=FK_VISION_JOB)
    champion_name: str | None = Field(default=None, max_length=100)
    champion_class: str | None = Field(default=None, max_length=50)
    stars: int = 0
    rank: int = 0
    signature: int = 0
    ascension: int = 0
    # The naming margin: the best gallery match's lead over the second best.
    confidence: float = Field(default=0.0)
    # All four or none, in screenshot pixels (see VisionPreview).
    preview_left: float | None = Field(default=None)
    preview_right: float | None = Field(default=None)
    preview_top: float | None = Field(default=None)
    preview_bottom: float | None = Field(default=None)

    job: "VisionJob" = Relationship(back_populates="predictions")

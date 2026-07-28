import uuid
from typing import TYPE_CHECKING

from sqlmodel import Field, Relationship

from src.models.Base import UUIDBase

if TYPE_CHECKING:
    from src.models.VisionPrediction import VisionPrediction


class VisionPredictionCandidate(UUIDBase, table=True):
    """One alternative CLIP considered for a prediction, with its score.

    `position` carries the ranking: 0 is the model's best guess. SQL guarantees
    no row order, so without it the top1-top2 margin would be computed over an
    arbitrary pair — wrong, and silently so. Every read orders by it.

    ON DELETE CASCADE because a candidate has no meaning without its prediction.
    This is the only cascade in the vision models: the import -> job ->
    prediction chain deliberately handles deletion in the service layer, and
    that is not changed here.
    """

    __tablename__ = "vision_prediction_candidate"

    prediction_id: uuid.UUID = Field(
        foreign_key="vision_prediction.id", ondelete="CASCADE", index=True
    )
    name: str = Field(max_length=100)
    score: float = Field(default=0.0)
    position: int = Field(default=0)

    prediction: "VisionPrediction" = Relationship(back_populates="candidates")

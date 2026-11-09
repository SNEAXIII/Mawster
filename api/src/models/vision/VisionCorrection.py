import uuid

from sqlmodel import Field

from src.enums.VisionCorrectionKind import VisionCorrectionKind
from src.models.Base import FK_VISION_IMPORT, FK_VISION_PREDICTION, TimestampMixin, UUIDBase


class VisionCorrection(UUIDBase, TimestampMixin, table=True):
    """One manual change made in the review screen, kept for every import.

    An EDITED row is one field: `predicted` is what the model read, `corrected`
    what the user confirmed. ADDED and REMOVED rows carry no field, only the card.
    Values are strings so one column holds a name, a rarity or a number.
    """

    __tablename__ = "vision_correction"

    import_id: uuid.UUID = Field(foreign_key=FK_VISION_IMPORT, index=True)
    prediction_id: uuid.UUID | None = Field(default=None, foreign_key=FK_VISION_PREDICTION)
    kind: VisionCorrectionKind
    field: str | None = Field(default=None, max_length=32)
    predicted: str | None = Field(default=None, max_length=100)
    corrected: str | None = Field(default=None, max_length=100)

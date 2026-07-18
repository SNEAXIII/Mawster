import uuid
from typing import Optional

from sqlmodel import Field

from src.models.Base import TimestampMixin, UUIDBase


class VisionSample(UUIDBase, TimestampMixin, table=True):
    """Metadata pointer for one opt-in dataset sample. Written only when
    share_dataset is set, on import confirmation. The actual prediction and
    the truth the user confirmed are not stored here: they live as JSON in
    the `dataset` bucket under `dataset_key` (samples/{sample_id}/sample.json).
    The correction is the most valuable training signal, and this row is how
    it gets found in the bucket.
    """

    __tablename__ = "vision_sample"

    import_id: uuid.UUID = Field(index=True)
    game_account_id: uuid.UUID = Field(index=True)
    screen_key: str = Field(max_length=255)
    dataset_key: Optional[str] = Field(default=None, max_length=255)

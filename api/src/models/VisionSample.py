import uuid
from typing import Optional

from sqlmodel import Field

from src.models.Base import TimestampMixin, UUIDBase


class VisionSample(UUIDBase, TimestampMixin, table=True):
    """One opt-in dataset sample: the screenshot, what the model predicted, and
    the truth the user confirmed. Written only when share_dataset is set, on
    import confirmation. The correction is the most valuable training signal.
    """

    __tablename__ = "vision_sample"

    import_id: uuid.UUID = Field(index=True)
    game_account_id: uuid.UUID = Field(index=True)
    screen_key: str = Field(max_length=255)
    pred_json: str
    truth_json: str
    dataset_key: Optional[str] = Field(default=None, max_length=255)

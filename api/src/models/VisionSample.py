import uuid
from typing import TYPE_CHECKING

from sqlmodel import Field, Relationship

from src.models.Base import TimestampMixin, UUIDBase

if TYPE_CHECKING:
    from src.models.VisionJob import VisionJob


class VisionSample(UUIDBase, TimestampMixin, table=True):
    """Opt-in dataset entry: the screenshot, what the model predicted, and what
    the user corrected it to. This is free ground truth for retraining."""

    __tablename__ = "vision_sample"

    job_id: uuid.UUID = Field(foreign_key="vision_job.id")
    screen_key: str = Field(max_length=255)
    prediction_json: str = Field(default="[]")
    truth_json: str = Field(default="[]")

    job: "VisionJob" = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[VisionSample.job_id]"}
    )

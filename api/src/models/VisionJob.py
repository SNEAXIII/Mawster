import uuid
from enum import Enum
from typing import TYPE_CHECKING

from sqlmodel import Field, Relationship

from src.models.Base import TimestampMixin, UUIDBase

if TYPE_CHECKING:
    from src.models.VisionImport import VisionImport
    from src.models.VisionPrediction import VisionPrediction


class VisionJobStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    DONE = "done"
    FAILED = "failed"


class VisionJob(UUIDBase, TimestampMixin, table=True):
    __tablename__ = "vision_job"

    import_id: uuid.UUID = Field(foreign_key="vision_import.id")
    status: VisionJobStatus = Field(default=VisionJobStatus.PENDING)
    object_key: str = Field(max_length=255)
    result_key: str | None = Field(default=None, max_length=255)
    error: str | None = Field(default=None, max_length=512)
    attempts: int = Field(default=0, ge=0)

    vision_import: "VisionImport" = Relationship(back_populates="jobs")
    predictions: list["VisionPrediction"] = Relationship(back_populates="job")

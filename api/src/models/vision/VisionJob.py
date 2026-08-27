import uuid
from typing import TYPE_CHECKING

from sqlmodel import Field, Relationship

from src.enums.VisionJobStatus import VisionJobStatus
from src.models.Base import TimestampMixin, UUIDBase

if TYPE_CHECKING:
    from src.models.vision.VisionImport import VisionImport
    from src.models.vision.VisionPrediction import VisionPrediction


class VisionJob(UUIDBase, TimestampMixin, table=True):
    __tablename__ = "vision_job"

    import_id: uuid.UUID = Field(foreign_key="vision_import.id")
    status: VisionJobStatus = Field(default=VisionJobStatus.PENDING)
    object_key: str = Field(max_length=255)
    # The client's own name for the screenshot, kept only so an upload error can
    # say which file the user has to look at. Nullable: jobs created before the
    # presigned flow never had one, and the multipart route still does not set it.
    filename: str | None = Field(default=None, max_length=255)
    result_key: str | None = Field(default=None, max_length=255)
    error: str | None = Field(default=None, max_length=512)
    attempts: int = Field(default=0, ge=0)

    vision_import: "VisionImport" = Relationship(back_populates="jobs")
    predictions: list["VisionPrediction"] = Relationship(back_populates="job")

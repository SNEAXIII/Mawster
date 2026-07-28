import uuid
from datetime import datetime

from pydantic import BaseModel

from src.models.VisionImport import VisionImportStatus
from src.models.VisionJob import VisionJobStatus


class VisionJobResponse(BaseModel):
    id: uuid.UUID
    status: VisionJobStatus
    error: str | None = None


class VisionImportResponse(BaseModel):
    id: uuid.UUID
    status: VisionImportStatus
    screens_total: int
    screens_done: int
    share_dataset: bool
    created_at: datetime


class VisionImportDetailResponse(VisionImportResponse):
    jobs: list[VisionJobResponse] = []

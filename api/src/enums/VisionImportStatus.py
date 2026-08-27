from enum import Enum


class VisionImportStatus(str, Enum):
    # Presigned URLs handed out, screenshots not uploaded yet. The import is not
    # runnable and not reviewable — only `commit` moves it to PENDING.
    AWAITING_UPLOAD = "awaiting_upload"
    PENDING = "pending"
    RUNNING = "running"
    DONE = "done"
    FAILED = "failed"
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"

from enum import Enum


class VisionJobStatus(str, Enum):
    # The row exists, the browser has not uploaded its screenshot yet. Distinct
    # from PENDING on purpose: PENDING means "queued, object is in the bucket",
    # and VisionReaperService republishes every PENDING job at startup. Reusing
    # PENDING here would make the reaper queue jobs whose object does not exist,
    # and the worker would fail every one of them.
    AWAITING_UPLOAD = "awaiting_upload"
    PENDING = "pending"
    RUNNING = "running"
    DONE = "done"
    FAILED = "failed"

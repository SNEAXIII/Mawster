from enum import Enum


class NoteReportStatus(str, Enum):
    PENDING = "pending"
    RESOLVED = "resolved"  # admin deleted the note
    DISMISSED = "dismissed"  # admin whitelisted the note

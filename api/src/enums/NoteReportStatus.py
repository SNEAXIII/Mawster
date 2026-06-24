from enum import Enum


class NoteReportStatus(str, Enum):
    pending = "pending"
    resolved = "resolved"  # admin deleted the note
    dismissed = "dismissed"  # admin whitelisted the note

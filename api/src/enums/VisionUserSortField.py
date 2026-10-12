from enum import Enum


class VisionUserSortField(str, Enum):
    IMPORTS_TOTAL = "imports_total"
    IMPORTS_CONFIRMED = "imports_confirmed"
    IMPORTS_CANCELLED = "imports_cancelled"
    IMPORTS_FAILED = "imports_failed"
    SCREENS_TOTAL = "screens_total"
    LAST_IMPORT_AT = "last_import_at"

from enum import Enum


class FightRecordSource(str, Enum):
    ALL = "all"
    IMPORTED = "imported"
    NON_IMPORTED = "non_imported"

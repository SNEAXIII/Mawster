from enum import Enum


class FightRecordSource(str, Enum):
    All = "all"
    Imported = "imported"
    NonImported = "non_imported"

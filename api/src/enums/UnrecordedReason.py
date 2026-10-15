from enum import StrEnum


class UnrecordedReason(StrEnum):
    ON_DEFENSE = "on_defense"
    NOT_IN_ROSTER = "not_in_roster"
    RECORDED_COPY_FREE = "recorded_copy_free"

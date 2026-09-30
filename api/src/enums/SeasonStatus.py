from enum import Enum


class SeasonStatus(str, Enum):
    UPCOMING = "upcoming"  # designated, format frozen, not live (pre-season)
    ACTIVE = "active"  # competition running, stats count
    ENDED = "ended"  # finished, archived

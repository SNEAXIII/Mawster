from enum import Enum


class SeasonStatus(str, Enum):
    upcoming = "upcoming"  # designated, format frozen, not live (pre-season)
    active = "active"  # competition running, stats count
    ended = "ended"  # finished, archived

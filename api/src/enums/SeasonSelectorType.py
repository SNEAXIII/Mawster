from enum import Enum


class SeasonSelectorType(str, Enum):
    ALL = "all"
    ALL_SEASONS = "all_seasons"
    CURRENT = "current"
    OFF_SEASON = "off_season"
    SPECIFIC = "specific"

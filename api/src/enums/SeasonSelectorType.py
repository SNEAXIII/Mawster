from enum import Enum


class SeasonSelectorType(str, Enum):
    All = "all"
    AllSeasons = "all_seasons"
    Current = "current"
    OffSeason = "off_season"
    Specific = "specific"

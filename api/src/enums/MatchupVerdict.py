from enum import Enum


class MatchupVerdict(str, Enum):
    """An alliance's verdict on a matchup.

    ``DISCOURAGED`` is not a low score: it short-circuits the combined score entirely.
    A missing rating is not a verdict — it means "no information", worth 0 points.
    """

    DISCOURAGED = "discouraged"
    OK = "ok"
    GOOD = "good"

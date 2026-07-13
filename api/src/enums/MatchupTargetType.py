from enum import Enum


class MatchupTargetType(str, Enum):
    """What a matchup rating is rated against. Exactly one target per rating row."""

    DEFENDER = "defender"
    NODE = "node"

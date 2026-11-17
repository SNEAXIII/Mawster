from enum import Enum


class AttackPreference(str, Enum):
    PREFERRED = "preferred"
    NEUTRAL = "neutral"
    DETESTED = "detested"

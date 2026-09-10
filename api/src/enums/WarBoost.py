from enum import Enum


class WarBoost(str, Enum):
    """A war-exclusive boost applied to the attacker of a single fight.

    The three are mutually exclusive in-game, so a fight holds at most one — hence a
    nullable column rather than three booleans. The class boosts (power, specials) and
    the defense boost stack freely and stay separate flags.
    """

    POWER_START = "power_start"
    INVULNERABILITY = "invulnerability"
    REGENERATION = "regeneration"

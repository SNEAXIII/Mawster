"""Presets mapping a season format to its structural war parameters.

This is the single source of truth for the numbers that change between
regular and big_thing formats. No DB / session access here.
"""

from dataclasses import dataclass

from src.enums.SeasonFormat import SeasonFormat


@dataclass(frozen=True)
class WarFormatParams:
    max_defenders_per_player: int
    max_attackers_per_member: int
    node_count: int


_PRESETS: dict[SeasonFormat, WarFormatParams] = {
    SeasonFormat.regular: WarFormatParams(
        max_defenders_per_player=5,
        max_attackers_per_member=3,
        node_count=50,
    ),
    SeasonFormat.big_thing: WarFormatParams(
        max_defenders_per_player=1,
        max_attackers_per_member=2,
        node_count=10,
    ),
}


def for_format(fmt: SeasonFormat) -> WarFormatParams:
    return _PRESETS[fmt]

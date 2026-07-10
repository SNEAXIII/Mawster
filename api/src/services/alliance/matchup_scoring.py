"""Pure, session-free matchup helpers.

Kept free of database concerns so the scoring rules can be unit-tested in isolation and
reused verbatim when v2 wires them into war attacker assignment.
"""

import uuid
from typing import Optional

from src.enums.MatchupTargetType import MatchupTargetType
from src.enums.MatchupVerdict import MatchupVerdict


def build_target_key(
    target_type: MatchupTargetType,
    defender_champion_id: Optional[uuid.UUID],
    node_number: Optional[int],
) -> str:
    """Build the denormalised uniqueness key for a rating's target.

    MariaDB allows several NULLs inside a UNIQUE index, so a unique constraint spanning the
    two nullable target columns would silently permit duplicates. This key collapses both
    targets into one NOT NULL column the index can rely on.
    """
    if target_type is MatchupTargetType.DEFENDER:
        if defender_champion_id is None:
            raise ValueError("A defender rating requires defender_champion_id")
        return f"def:{defender_champion_id}"
    if node_number is None:
        raise ValueError("A node rating requires node_number")
    return f"node:{node_number}"


VERDICT_POINTS: dict[MatchupVerdict, int] = {
    MatchupVerdict.OK: 1,
    MatchupVerdict.GOOD: 2,
}


def combine_verdicts(
    defender_verdict: Optional[MatchupVerdict],
    node_verdict: Optional[MatchupVerdict],
) -> tuple[bool, Optional[int]]:
    """Combine the defender and node verdicts into ``(is_discouraged, score)``.

    A single ``DISCOURAGED`` on either side wins outright and suppresses the score: the fight
    is reported as discouraged, never as a number. Otherwise the two sides add up, an absent
    rating contributing 0 — no information is not a bad verdict.
    """
    if MatchupVerdict.DISCOURAGED in (defender_verdict, node_verdict):
        return True, None
    return False, VERDICT_POINTS.get(defender_verdict, 0) + VERDICT_POINTS.get(node_verdict, 0)


def format_instance_label(stars: int, rank: int, ascension: int, signature: int) -> str:
    """Render a roster instance the way the game shows it, e.g. ``7r5 a2 sig 200``."""
    ascension_part = f" a{ascension}" if ascension else ""
    return f"{stars}r{rank}{ascension_part} sig {signature}"


def resolve_missing_champions(
    champion_id: uuid.UUID,
    required_synergy_ids: list[uuid.UUID],
    owned_champion_ids: set[uuid.UUID],
) -> list[uuid.UUID]:
    """Return every champion the player needs for this rated fight but does not own.

    The rated champion itself and its *required* synergies. Recommended synergies never
    appear here, and the prefight is never checked — anyone can field a prefight champion.
    """
    needed = [champion_id, *required_synergy_ids]
    return [needed_id for needed_id in needed if needed_id not in owned_champion_ids]

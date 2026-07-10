"""Pure, session-free matchup helpers.

Kept free of database concerns so the scoring rules can be unit-tested in isolation and
reused verbatim when v2 wires them into war attacker assignment.
"""

import uuid
from typing import Optional

from src.enums.MatchupTargetType import MatchupTargetType


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

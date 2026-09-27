# ─── Defense error messages ──────────────────────────────
CHAMPION_NOT_FOUND_IN_ROSTER = "Champion not found in roster"
CHAMPION_NOT_BELONG_TO_PLAYER = "This champion does not belong to the specified player"
GAME_ACCOUNT_NOT_FOUND = "Game account not found"
PLAYER_NOT_IN_ALLIANCE = "Player is not in this alliance"
PLAYER_NOT_IN_BATTLEGROUP = "Player is not in this battlegroup"
CHAMPION_ALREADY_PLACED_OTHER_NODE = "This champion is already placed on another node"
NO_DEFENDER_ON_NODE = "No defender on this node"


def player_max_defenders_reached(max_defenders: int) -> str:  # pragma: no cover
    return f"Player already has {max_defenders} defenders placed"


def node_exceeds_map(max_node: int) -> str:  # pragma: no cover
    return f"Node number must be between 1 and {max_node} for the current format"


TEMPLATE_NOT_FOUND = "Defense template not found"
TEMPLATE_NAME_TAKEN = "A template with this name already exists for this format"
FORMAT_MISMATCH = "The source belongs to another format"
CHAMPION_NOT_FOUND = "Champion not found"
NO_CHAMPION_ON_NODE = "No champion on this node"


def template_quota_reached(limit: int) -> str:  # pragma: no cover
    return f"This format already holds {limit} templates"

# ─── Defense error messages ──────────────────────────────
CHAMPION_NOT_FOUND_IN_ROSTER = "Champion not found in roster"
PLAYER_NOT_IN_ALLIANCE = "Player is not in this alliance"
PLAYER_NOT_IN_BATTLEGROUP = "Player is not in this battlegroup"
CHAMPION_ALREADY_PLACED_OTHER_NODE = "This champion is already placed on another node"


def player_max_defenders_reached(max_defenders: int) -> str:  # pragma: no cover
    return f"Player already has {max_defenders} defenders placed"


def node_exceeds_map(max_node: int) -> str:  # pragma: no cover
    return f"Node number must be between 1 and {max_node} for the current format"


TEMPLATE_NOT_FOUND = "Defense template not found"
TEMPLATE_NAME_TAKEN = "A template with this name already exists for this format"
FORMAT_MISMATCH = "The source belongs to another format"
CHAMPION_NOT_FOUND = "Champion not found"
NO_CHAMPION_ON_NODE = "No champion on this node"
CHAMPION_USER_MISMATCH = "This roster entry is not the champion placed on the node"


def template_quota_reached(limit: int) -> str:  # pragma: no cover
    return f"This format already holds {limit} templates"


PLAN_NOT_FOUND = "Defense plan not found"
PLAN_NAME_TAKEN = "A plan with this name already exists for this battlegroup and format"
SOURCE_PLAN_OTHER_BATTLEGROUP = "The source plan belongs to another battlegroup"
PLAN_NOT_VALIDATED = "Only a validated plan can be activated"


def plan_quota_reached(limit: int) -> str:  # pragma: no cover
    return f"This battlegroup already holds {limit} plans for this format"

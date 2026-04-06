# ─── Defense error messages ──────────────────────────────
BATTLEGROUP_INVALID = "Battlegroup must be 1, 2, or 3"
CHAMPION_NOT_FOUND_IN_ROSTER = "Champion not found in roster"
CHAMPION_NOT_BELONG_TO_PLAYER = "This champion does not belong to the specified player"
GAME_ACCOUNT_NOT_FOUND = "Game account not found"
PLAYER_NOT_IN_ALLIANCE = "Player is not in this alliance"
PLAYER_NOT_IN_BATTLEGROUP = "Player is not in this battlegroup"
CHAMPION_ALREADY_PLACED_OTHER_NODE = "This champion is already placed on another node"
NO_DEFENDER_ON_NODE = "No defender on this node"


def player_max_defenders_reached(max_defenders: int) -> str:
	return f"Player already has {max_defenders} defenders placed"

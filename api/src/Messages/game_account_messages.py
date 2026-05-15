# ─── Game Account error messages ──────────────────────────
GAME_ACCOUNT_NOT_FOUND = "Game account not found"
NOT_YOUR_GAME_ACCOUNT = "Not your game account"
GAME_ACCOUNT_IS_ALLIANCE_OWNER = "Cannot delete a game account that owns an alliance"


def max_game_accounts_reached(max_accounts: int) -> str:
    return f"Maximum {max_accounts} game accounts allowed per user"

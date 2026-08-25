# ─── Game Account error messages ──────────────────────────
GAME_ACCOUNT_NOT_FOUND = "Game account not found"
NOT_YOUR_GAME_ACCOUNT = "Not your game account"
GAME_ACCOUNT_IS_ALLIANCE_OWNER = "Cannot delete a game account that owns an alliance"
GAME_ACCOUNT_IN_ALLIANCE = "Leave your alliance before deleting this game account"
GAME_ACCOUNT_ALREADY_DELETED = "Game account is already deleted"
GAME_ACCOUNT_NOT_DELETED = "Game account is not deleted"
GAME_ACCOUNT_RESTORE_EXPIRED = "The restore window has expired, this game account is lost"


def max_game_accounts_reached(max_accounts: int) -> str:
    return f"Maximum {max_accounts} game accounts allowed per user"

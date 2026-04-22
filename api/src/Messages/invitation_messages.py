# ─── Invitation error messages ───────────────────────────
INVITATION_NOT_FOUND = "Invitation not found"
INVITATION_NO_LONGER_PENDING = "This invitation is no longer pending"
GAME_ACCOUNT_NOT_FOUND = "Game account not found"
GAME_ACCOUNT_ALREADY_IN_ALLIANCE = "This game account is already in an alliance"
PENDING_INVITATION_ALREADY_EXISTS = (
    "A pending invitation already exists for this game account in this alliance"
)
INVITER_NOT_IN_ALLIANCE = "You don't have a game account in this alliance"
INVITATION_NOT_FOR_YOUR_GAME_ACCOUNT = "This invitation is not for your game account"
INVITATION_NOT_IN_THIS_ALLIANCE = "This invitation does not belong to this alliance"


def alliance_max_members_reached(max_members: int) -> str:
    return f"This alliance already has {max_members} members (maximum reached)"

# ─── Alliance error messages ─────────────────────────────
ALLIANCE_NOT_FOUND = "Alliance not found"
NOT_ALLIANCE_MEMBER = "You are not a member of this alliance"
GAME_ACCOUNT_ALREADY_IN_ALLIANCE = "This game account is already in an alliance"
GAME_ACCOUNT_NOT_MEMBER_OF_ALLIANCE = "Game account is not a member of this alliance"
OWNER_OR_OFFICER_REQUIRED = "Only the alliance owner or an officer can perform this action"
STRATEGIST_REQUIRED = "Only the alliance owner, an officer or a strategist can perform this action"
PLACE_FOR_OTHERS_REQUIRES_STRATEGIST = (
    "Only the alliance owner, an officer or a strategist can place defenders for other players"
)
OWNER_REQUIRED = "Only the alliance owner can perform this action"
OFFICER_CANNOT_REMOVE_OFFICER = "An officer cannot remove another officer"
OWNER_GAME_ACCOUNT_NOT_FOUND = "Owner game account not found"
GAME_ACCOUNT_NOT_FOUND = "Game account not found"
GAME_ACCOUNT_NOT_YOURS = "This game account does not belong to you"
CANNOT_REMOVE_OWNER = "Cannot remove the owner from the alliance"
GAME_ACCOUNT_MUST_BE_MEMBER_TO_BECOME_OFFICER = (
    "Game account must be a member of the alliance to become an officer"
)
GAME_ACCOUNT_ALREADY_OFFICER = "Game account is already an officer of this alliance"
GAME_ACCOUNT_NOT_OFFICER = "This game account is not an officer of this alliance"
GAME_ACCOUNT_MUST_BE_MEMBER_TO_BECOME_STRATEGIST = (
    "Game account must be a member of the alliance to become a strategist"
)
GAME_ACCOUNT_ALREADY_STRATEGIST = "Game account is already a strategist of this alliance"
GAME_ACCOUNT_NOT_STRATEGIST = "This game account is not a strategist of this alliance"
OFFICER_CANNOT_BE_STRATEGIST = "An officer already outranks a strategist"
INVALID_GROUP_VALUE = "Group must be 1, 2, 3 or null"
ALLIANCE_NOT_EMPTY = "The alliance still has other members: remove them all before deleting it"
ALLIANCE_NAME_CONFIRMATION_MISMATCH = "The confirmation name does not match the alliance name"


def alliance_max_members_reached(max_members: int) -> str:
    return f"This alliance already has {max_members} members (maximum reached)"


def group_max_members_reached(group: int, max_members: int) -> str:
    return f"Group {group} already has {max_members} members (maximum reached)"

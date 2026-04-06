# ─── Alliance error messages ─────────────────────────────
ALLIANCE_NOT_FOUND = "Alliance not found"
NOT_ALLIANCE_MEMBER = "You are not a member of this alliance"
GAME_ACCOUNT_ALREADY_IN_ALLIANCE = "This game account is already in an alliance"
GAME_ACCOUNT_NOT_MEMBER_OF_ALLIANCE = "Game account is not a member of this alliance"
OWNER_OR_OFFICER_REQUIRED = "Only the alliance owner or an officer can perform this action"
OWNER_REQUIRED = "Only the alliance owner can perform this action"
OFFICER_CANNOT_REMOVE_OFFICER = "An officer cannot remove another officer"
OWNER_GAME_ACCOUNT_NOT_FOUND = "Owner game account not found"
GAME_ACCOUNT_NOT_FOUND = "Game account not found"
GAME_ACCOUNT_NOT_YOURS = "This game account does not belong to you"
CANNOT_REMOVE_OWNER = "Cannot remove the owner from the alliance"
GAME_ACCOUNT_MUST_BE_MEMBER_TO_BECOME_OFFICER = "Game account must be a member of the alliance to become an officer"
GAME_ACCOUNT_ALREADY_OFFICER = "Game account is already an officer of this alliance"
GAME_ACCOUNT_NOT_OFFICER = "This game account is not an officer of this alliance"
INVALID_GROUP_VALUE = "Group must be 1, 2, 3 or null"


def alliance_max_members_reached(max_members: int) -> str:
	return f"This alliance already has {max_members} members (maximum reached)"


def group_max_members_reached(group: int, max_members: int) -> str:
	return f"Group {group} already has {max_members} members (maximum reached)"

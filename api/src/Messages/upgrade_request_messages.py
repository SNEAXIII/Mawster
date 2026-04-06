# ─── Upgrade request error messages ──────────────────────
CHAMPION_USER_ENTRY_NOT_FOUND = "Champion user entry not found"
UPGRADE_REQUEST_ALREADY_EXISTS = "An upgrade request for this rarity already exists"
UPGRADE_REQUEST_NOT_FOUND = "Upgrade request not found"


def invalid_requested_rarity(requested_rarity: str, valid_rarities: str) -> str:
    return f"Invalid rarity '{requested_rarity}'. Must be one of: {valid_rarities}"


def requested_rarity_must_be_higher(requested_rarity: str, current_rarity: str) -> str:
    return (
        f"Requested rarity '{requested_rarity}' must be higher than current rarity '{current_rarity}'"
    )

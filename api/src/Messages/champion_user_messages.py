# ─── Champion User error messages ────────────────────────
CHAMPION_USER_NOT_FOUND = "Champion user not found"
NOT_YOUR_CHAMPION = "Not your champion"
GAME_ACCOUNT_NOT_FOUND = "Game account not found"
CHAMPION_NOT_FOUND = "Champion not found"
CHAMPION_CANNOT_BE_ASCENDED = "This champion cannot be ascended"


def invalid_rarity(rarity: str, valid_rarities: str) -> str:
    return f"Invalid rarity '{rarity}'. Must be one of: {valid_rarities}"


def invalid_rarity_format(rarity: str) -> str:
    return f"Invalid rarity format '{rarity}'"


def invalid_ascension_level(ascension: int) -> str:
    return f"Invalid ascension level '{ascension}'. Must be 0, 1, or 2."


def champion_name_not_found(champion_name: str) -> str:
    return f"Champion '{champion_name}' not found"


def champion_already_max_rank(current_rarity: str) -> str:
    return f"Champion is already at maximum rank ({current_rarity})"


def champion_already_max_ascension(current_ascension: int) -> str:
    return f"Champion is already at maximum ascension (A{current_ascension})"

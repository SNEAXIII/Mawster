import uuid

# ─── Tier list error messages ────────────────────────
TIER_LIST_NOT_FOUND = "Tier list not found"


def too_many_tier_lists(maximum: int) -> str:
    return f"You already hold {maximum} tier lists. Delete one before creating another."


def unknown_champions(count: int) -> str:
    return f"{count} champion(s) in this tier list are not in the catalog"


def duplicate_ranking(champion_id: uuid.UUID) -> str:
    return f"Champion {champion_id} is ranked more than once"


def duplicate_tag(champion_id: uuid.UUID) -> str:
    return f"Champion {champion_id} is tagged more than once"


def too_many_rankings(maximum: int) -> str:
    return f"A tier list holds at most {maximum} ranked champions"

ALREADY_A_VISITOR = "This game account is already visiting this alliance"
NOT_A_VISITOR = "This game account is not visiting this alliance"


def alliance_max_visitors_reached(max_visitors: int) -> str:
    return f"This alliance already has {max_visitors} visitors (maximum reached)"

import uuid
from collections import Counter

from src.enums.DefensePlanState import DefensePlanState


def compute_plan_state(
    assignees: list[uuid.UUID | None],
    member_ids: set[uuid.UUID],
    node_count: int,
    cap: int,
) -> DefensePlanState:
    """Validated per CONTEXT.md; see ADR 0018 for why this is never stored."""
    if any(assignee not in member_ids for assignee in assignees):
        return DefensePlanState.incomplete
    held = Counter(assignees)
    if any(count > cap for count in held.values()):
        return DefensePlanState.incomplete
    if len(assignees) == node_count:
        return DefensePlanState.validated
    if member_ids and all(held[member] == cap for member in member_ids):
        return DefensePlanState.validated
    return DefensePlanState.incomplete

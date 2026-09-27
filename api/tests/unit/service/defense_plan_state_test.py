"""Unit tests for compute_plan_state — the Validated rule of CONTEXT.md, no DB."""

import uuid

from src.enums.DefensePlanState import DefensePlanState
from src.services.alliance.defense.plan_state import compute_plan_state

A, B = uuid.uuid4(), uuid.uuid4()


def test_empty_battlegroup_is_never_validated():
    assert compute_plan_state([], set(), node_count=50, cap=5) == DefensePlanState.pending


def test_empty_plan_with_members_is_pending():
    assert compute_plan_state([], {A, B}, node_count=50, cap=5) == DefensePlanState.pending


def test_full_map_is_validated():
    assignees = [uuid.uuid4() for _ in range(10)]
    state = compute_plan_state(assignees, set(assignees), node_count=10, cap=1)
    assert state == DefensePlanState.validated


def test_champion_without_player_is_pending():
    assert compute_plan_state([A, None], {A}, node_count=2, cap=5) == DefensePlanState.pending


def test_player_no_longer_in_battlegroup_is_pending():
    assert compute_plan_state([A, B], {A}, node_count=2, cap=5) == DefensePlanState.pending


def test_player_over_the_cap_is_pending():
    assert compute_plan_state([A, A], {A}, node_count=2, cap=1) == DefensePlanState.pending


def test_partial_map_with_every_member_at_cap_is_validated():
    assignees = [A] * 5 + [B] * 5
    state = compute_plan_state(assignees, {A, B}, node_count=50, cap=5)
    assert state == DefensePlanState.validated


def test_partial_map_with_a_member_below_cap_is_pending():
    assignees = [A] * 5 + [B] * 4
    state = compute_plan_state(assignees, {A, B}, node_count=50, cap=5)
    assert state == DefensePlanState.pending

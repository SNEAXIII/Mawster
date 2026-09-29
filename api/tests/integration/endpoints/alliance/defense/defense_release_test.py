"""A departing Player leaves their Champions on the plans — CONTEXT.md, Defense Plan."""

import pytest

from src.enums.SeasonFormat import SeasonFormat
from tests.integration.endpoints.setup.defense_setup import (
    push_plan,
    push_plan_node,
    setup_defense_bg,
)
from tests.utils.utils_client import (
    create_auth_headers,
    execute_delete_request,
    execute_get_request,
    execute_patch_request,
)
from tests.utils.utils_constant import USER2_ID, USER_ID

OWNER = create_auth_headers(user_id=str(USER_ID))
MEMBER = create_auth_headers(user_id=str(USER2_ID))


async def _plan_body(alliance_id, plan_id) -> dict:
    return (
        await execute_get_request(
            f"/alliances/{alliance_id}/defense/plans/{plan_id}", headers=OWNER
        )
    ).json()


def _nodes(body: dict) -> list[tuple[int, str, str | None]]:
    return [(n["node_number"], n["champion_name"], n["game_account_id"]) for n in body["nodes"]]


class TestRelease:
    @pytest.mark.asyncio
    async def test_kicked_member_leaves_the_champion_and_the_active_plan_turns_incomplete(self):
        bg = await setup_defense_bg()
        plan = await push_plan(bg.alliance.id, fmt=SeasonFormat.big_thing, active=True)
        await push_plan_node(plan, 1, bg.owner_spider)
        await push_plan_node(plan, 2, bg.member_iron_man)
        resp = await execute_delete_request(
            f"/alliances/{bg.alliance.id}/members/{bg.member.id}", headers=OWNER
        )
        assert resp.status_code == 200
        body = await _plan_body(bg.alliance.id, plan.id)
        assert _nodes(body) == [
            (1, "Spider-Man", str(bg.owner.id)),
            (2, "Iron Man", None),
        ]
        assert (body["is_active"], body["state"]) == (True, "incomplete")

    @pytest.mark.asyncio
    async def test_member_moved_to_another_battlegroup_leaves_the_champion(self):
        bg = await setup_defense_bg()
        plan = await push_plan(bg.alliance.id)
        await push_plan_node(plan, 3, bg.member_iron_man)
        resp = await execute_patch_request(
            f"/alliances/{bg.alliance.id}/members/{bg.member.id}/group", {"group": 2}, headers=OWNER
        )
        assert resp.status_code == 200
        assert _nodes(await _plan_body(bg.alliance.id, plan.id)) == [(3, "Iron Man", None)]

    @pytest.mark.asyncio
    async def test_deleted_roster_entry_leaves_the_champion(self):
        bg = await setup_defense_bg()
        plan = await push_plan(bg.alliance.id)
        await push_plan_node(plan, 4, bg.member_iron_man)
        resp = await execute_delete_request(
            f"/champion-users/{bg.member_iron_man.id}", headers=MEMBER
        )
        assert resp.status_code == 204
        assert _nodes(await _plan_body(bg.alliance.id, plan.id)) == [(4, "Iron Man", None)]

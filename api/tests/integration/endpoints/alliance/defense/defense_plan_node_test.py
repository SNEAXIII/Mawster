"""Integration tests for editing the nodes of a Defense Plan."""

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
    execute_put_request,
)
from tests.utils.utils_constant import GAME_PSEUDO, USER2_ID, USER_ID
from tests.utils.utils_db import load_objects

OWNER = create_auth_headers(user_id=str(USER_ID))
MEMBER = create_auth_headers(user_id=str(USER2_ID))
BIG = SeasonFormat.big_thing


def _node(alliance_id, plan_id, node: int) -> str:
    return f"/alliances/{alliance_id}/defense/plans/{plan_id}/nodes/{node}"


def _plan(alliance_id, plan_id, suffix: str = "") -> str:
    return f"/alliances/{alliance_id}/defense/plans/{plan_id}{suffix}"


class TestPlanNodes:
    @pytest.mark.asyncio
    async def test_roster_entry_alone_places_its_champion_and_player(self):
        bg = await setup_defense_bg()
        plan = await push_plan(bg.alliance.id)
        resp = await execute_put_request(
            _node(bg.alliance.id, plan.id, 1),
            {"champion_user_id": str(bg.owner_spider.id)},
            headers=OWNER,
        )
        assert resp.status_code == 200
        node = resp.json()["nodes"][0]
        assert (node["champion_name"], node["game_pseudo"]) == ("Spider-Man", GAME_PSEUDO)
        assert node["placed_by_pseudo"] == GAME_PSEUDO

    @pytest.mark.asyncio
    async def test_empty_body_is_refused(self):
        bg = await setup_defense_bg()
        plan = await push_plan(bg.alliance.id)
        resp = await execute_put_request(_node(bg.alliance.id, plan.id, 1), {}, headers=OWNER)
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_player_of_another_battlegroup_is_refused(self):
        bg = await setup_defense_bg()
        bg.member.alliance_group = 2
        await load_objects([bg.member])
        plan = await push_plan(bg.alliance.id)
        resp = await execute_put_request(
            _node(bg.alliance.id, plan.id, 1),
            {"champion_user_id": str(bg.member_iron_man.id)},
            headers=OWNER,
        )
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_roster_entry_of_another_champion_is_refused(self):
        bg = await setup_defense_bg()
        plan = await push_plan(bg.alliance.id)
        resp = await execute_put_request(
            _node(bg.alliance.id, plan.id, 1),
            {"champion_id": str(bg.wolverine.id), "champion_user_id": str(bg.owner_spider.id)},
            headers=OWNER,
        )
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_cap_counts_only_the_edited_plan(self):
        bg = await setup_defense_bg()
        first = await push_plan(bg.alliance.id, fmt=BIG, name="A")
        await push_plan_node(first, 1, bg.owner_spider)
        over = await execute_put_request(
            _node(bg.alliance.id, first.id, 2),
            {"champion_user_id": str(bg.owner_wolverine.id)},
            headers=OWNER,
        )
        assert over.status_code == 400
        second = await push_plan(bg.alliance.id, fmt=BIG, name="B")
        fine = await execute_put_request(
            _node(bg.alliance.id, second.id, 1),
            {"champion_user_id": str(bg.owner_wolverine.id)},
            headers=OWNER,
        )
        assert fine.status_code == 200

    @pytest.mark.asyncio
    async def test_same_champion_on_two_nodes_is_refused(self):
        bg = await setup_defense_bg()
        plan = await push_plan(bg.alliance.id)
        await push_plan_node(plan, 1, bg.owner_spider)
        resp = await execute_put_request(
            _node(bg.alliance.id, plan.id, 2),
            {"champion_user_id": str(bg.member_spider.id)},
            headers=OWNER,
        )
        assert resp.status_code == 409

    @pytest.mark.asyncio
    async def test_player_assigned_to_a_champion_only_node(self):
        bg = await setup_defense_bg()
        plan = await push_plan(bg.alliance.id)
        await push_plan_node(plan, 5, champion=bg.spider)
        resp = await execute_put_request(
            _node(bg.alliance.id, plan.id, 5),
            {"champion_id": str(bg.spider.id), "champion_user_id": str(bg.member_spider.id)},
            headers=OWNER,
        )
        assert resp.json()["nodes"][0]["game_account_id"] == str(bg.member.id)

    @pytest.mark.asyncio
    async def test_node_beyond_the_big_thing_map_is_refused(self):
        bg = await setup_defense_bg()
        plan = await push_plan(bg.alliance.id, fmt=BIG)
        resp = await execute_put_request(
            _node(bg.alliance.id, plan.id, 11), {"champion_id": str(bg.spider.id)}, headers=OWNER
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_plain_member_cannot_edit_even_the_active_plan(self):
        bg = await setup_defense_bg()
        plan = await push_plan(bg.alliance.id, active=True)
        resp = await execute_put_request(
            _node(bg.alliance.id, plan.id, 1),
            {"champion_user_id": str(bg.member_iron_man.id)},
            headers=MEMBER,
        )
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_remove_then_clear(self):
        bg = await setup_defense_bg()
        plan = await push_plan(bg.alliance.id)
        await push_plan_node(plan, 1, bg.owner_spider)
        await push_plan_node(plan, 2, bg.member_iron_man)
        route = _node(bg.alliance.id, plan.id, 1)
        assert (await execute_delete_request(route, headers=OWNER)).status_code == 204
        assert (await execute_delete_request(route, headers=OWNER)).status_code == 404
        cleared = await execute_delete_request(
            _plan(bg.alliance.id, plan.id, "/nodes"), headers=OWNER
        )
        assert cleared.status_code == 204
        body = (await execute_get_request(_plan(bg.alliance.id, plan.id), headers=OWNER)).json()
        assert body["nodes"] == []


class TestFormatIsolation:
    @pytest.mark.asyncio
    async def test_editing_the_big_thing_plan_leaves_the_regular_plan_untouched(self):
        bg = await setup_defense_bg()
        regular = await push_plan(bg.alliance.id, active=True)
        await push_plan_node(regular, 1, bg.owner_spider)
        await push_plan_node(regular, 12, bg.member_iron_man)
        big = await push_plan(bg.alliance.id, fmt=BIG, active=True)
        await execute_put_request(
            _node(bg.alliance.id, big.id, 1),
            {"champion_user_id": str(bg.member_spider.id)},
            headers=OWNER,
        )
        body = (await execute_get_request(_plan(bg.alliance.id, regular.id), headers=OWNER)).json()
        assert [(n["node_number"], n["game_account_id"]) for n in body["nodes"]] == [
            (1, str(bg.owner.id)),
            (12, str(bg.member.id)),
        ]


class TestSelectorData:
    @pytest.mark.asyncio
    async def test_champion_on_the_edited_node_stays_available(self):
        bg = await setup_defense_bg()
        plan = await push_plan(bg.alliance.id)
        await push_plan_node(plan, 1, bg.owner_spider)
        route = _plan(bg.alliance.id, plan.id, "/available-champions?node_number=")
        elsewhere = (await execute_get_request(f"{route}2", headers=OWNER)).json()
        here = (await execute_get_request(f"{route}1", headers=OWNER)).json()
        assert "Spider-Man" not in [c["champion_name"] for c in elsewhere]
        assert "Spider-Man" in [c["champion_name"] for c in here]

    @pytest.mark.asyncio
    async def test_player_at_cap_is_not_offered(self):
        bg = await setup_defense_bg()
        plan = await push_plan(bg.alliance.id, fmt=BIG)
        await push_plan_node(plan, 1, bg.owner_spider)
        route = _plan(bg.alliance.id, plan.id, "/available-champions?node_number=2")
        names = [
            c["champion_name"] for c in (await execute_get_request(route, headers=OWNER)).json()
        ]
        assert "Wolverine" not in names

    @pytest.mark.asyncio
    async def test_battlegroup_members_count_the_active_plan(self):
        bg = await setup_defense_bg()
        plan = await push_plan(bg.alliance.id, active=True)
        await push_plan_node(plan, 1, bg.owner_spider)
        route = f"/alliances/{bg.alliance.id}/defense/bg/1/members"
        rows = (await execute_get_request(route, headers=MEMBER)).json()
        counts = {r["game_pseudo"]: (r["defender_count"], r["max_defenders"]) for r in rows}
        assert counts[GAME_PSEUDO] == (1, 5)

"""Integration tests for Defense Plan lifecycle, activation and the Active Plan view."""

import pytest

from src.enums.SeasonFormat import SeasonFormat
from tests.integration.endpoints.setup.defense_setup import (
    push_other_alliance,
    push_plan,
    push_plan_node,
    push_template,
    setup_defense_bg,
)
from tests.integration.endpoints.setup.game_setup import push_alliance_with_owner, push_visitor
from tests.integration.endpoints.setup.user_setup import get_generic_user, push_user2
from tests.utils.utils_client import (
    create_auth_headers,
    execute_delete_request,
    execute_get_request,
    execute_patch_request,
    execute_post_request,
    execute_put_request,
)
from tests.utils.utils_constant import USER2_ID, USER_ID
from tests.utils.utils_db import load_objects

OWNER = create_auth_headers(user_id=str(USER_ID))
MEMBER = create_auth_headers(user_id=str(USER2_ID))
BIG = SeasonFormat.big_thing


def _bg_route(alliance_id, suffix: str, battlegroup: int = 1) -> str:
    return f"/alliances/{alliance_id}/defense/bg/{battlegroup}{suffix}"


def _plan_route(alliance_id, plan_id, suffix: str = "") -> str:
    return f"/alliances/{alliance_id}/defense/plans/{plan_id}{suffix}"


async def _validated_big_thing_plan(bg, name: str = "Plan", active: bool = False):
    """Two members, cap 1: one node each makes the plan Validated."""
    plan = await push_plan(bg.alliance.id, fmt=BIG, name=name, active=active)
    await push_plan_node(plan, 1, bg.owner_spider)
    await push_plan_node(plan, 2, bg.member_iron_man)
    return plan


class TestPlanCreation:
    @pytest.mark.asyncio
    async def test_plan_from_scratch_is_empty_and_pending(self):
        bg = await setup_defense_bg()
        resp = await execute_post_request(
            _bg_route(bg.alliance.id, "/plans"), {"name": "A", "format": "regular"}, headers=OWNER
        )
        assert resp.status_code == 201
        body = resp.json()
        assert (body["nodes"], body["state"], body["is_active"]) == ([], "incomplete", False)
        listing = await execute_get_request(
            _bg_route(bg.alliance.id, "/plans?format=regular"), headers=OWNER
        )
        assert listing.json()["quota"] == {"used": 1, "limit": 10}

    @pytest.mark.asyncio
    async def test_plan_from_template_copies_champions_without_players(self):
        bg = await setup_defense_bg()
        template = await push_template(bg.alliance.id, champions={1: bg.spider, 2: bg.wolverine})
        resp = await execute_post_request(
            _bg_route(bg.alliance.id, "/plans"),
            {"name": "A", "format": "regular", "template_id": str(template.id)},
            headers=OWNER,
        )
        body = resp.json()
        assert body["source_template_id"] == str(template.id)
        assert [(n["champion_name"], n["game_account_id"]) for n in body["nodes"]] == [
            ("Spider-Man", None),
            ("Wolverine", None),
        ]

    @pytest.mark.asyncio
    async def test_template_edit_after_copy_leaves_the_plan_untouched(self):
        bg = await setup_defense_bg()
        template = await push_template(bg.alliance.id, champions={1: bg.spider})
        created = await execute_post_request(
            _bg_route(bg.alliance.id, "/plans"),
            {"name": "A", "format": "regular", "template_id": str(template.id)},
            headers=OWNER,
        )
        await execute_put_request(
            f"/alliances/{bg.alliance.id}/defense/templates/{template.id}/nodes/5",
            {"champion_id": str(bg.iron_man.id)},
            headers=OWNER,
        )
        plan = await execute_get_request(
            _plan_route(bg.alliance.id, created.json()["id"]), headers=OWNER
        )
        assert [n["node_number"] for n in plan.json()["nodes"]] == [1]

    @pytest.mark.asyncio
    async def test_template_of_another_format_is_refused(self):
        bg = await setup_defense_bg()
        template = await push_template(bg.alliance.id, fmt=BIG)
        resp = await execute_post_request(
            _bg_route(bg.alliance.id, "/plans"),
            {"name": "A", "format": "regular", "template_id": str(template.id)},
            headers=OWNER,
        )
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_duplicate_keeps_the_players(self):
        bg = await setup_defense_bg()
        source = await push_plan(bg.alliance.id, name="Source")
        await push_plan_node(source, 1, bg.owner_spider)
        resp = await execute_post_request(
            _bg_route(bg.alliance.id, "/plans"),
            {"name": "Copy", "format": "regular", "source_plan_id": str(source.id)},
            headers=OWNER,
        )
        assert resp.json()["nodes"][0]["game_account_id"] == str(bg.owner.id)

    @pytest.mark.asyncio
    async def test_duplicate_from_another_battlegroup_is_refused(self):
        bg = await setup_defense_bg()
        source = await push_plan(bg.alliance.id, battlegroup=2)
        resp = await execute_post_request(
            _bg_route(bg.alliance.id, "/plans"),
            {"name": "Copy", "format": "regular", "source_plan_id": str(source.id)},
            headers=OWNER,
        )
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_template_and_source_plan_together_are_refused(self):
        bg = await setup_defense_bg()
        template = await push_template(bg.alliance.id)
        source = await push_plan(bg.alliance.id)
        resp = await execute_post_request(
            _bg_route(bg.alliance.id, "/plans"),
            {
                "name": "A",
                "format": "regular",
                "template_id": str(template.id),
                "source_plan_id": str(source.id),
            },
            headers=OWNER,
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_eleventh_plan_is_refused(self):
        bg = await setup_defense_bg()
        for i in range(10):
            await push_plan(bg.alliance.id, name=f"P{i}")
        refused = await execute_post_request(
            _bg_route(bg.alliance.id, "/plans"), {"name": "P10", "format": "regular"}, headers=OWNER
        )
        assert refused.status_code == 409
        other_format = await execute_post_request(
            _bg_route(bg.alliance.id, "/plans"),
            {"name": "P10", "format": "big_thing"},
            headers=OWNER,
        )
        assert other_format.status_code == 201

    @pytest.mark.asyncio
    async def test_rename_to_a_taken_name_is_refused(self):
        bg = await setup_defense_bg()
        await push_plan(bg.alliance.id, name="A")
        other = await push_plan(bg.alliance.id, name="B")
        resp = await execute_patch_request(
            _plan_route(bg.alliance.id, other.id), {"name": "A"}, headers=OWNER
        )
        assert resp.status_code == 409


class TestActivation:
    @pytest.mark.asyncio
    async def test_every_member_at_cap_makes_the_plan_validated(self):
        bg = await setup_defense_bg()
        plan = await _validated_big_thing_plan(bg)
        resp = await execute_get_request(_plan_route(bg.alliance.id, plan.id), headers=OWNER)
        assert resp.json()["state"] == "validated"

    @pytest.mark.asyncio
    async def test_pending_plan_cannot_be_activated(self):
        bg = await setup_defense_bg()
        plan = await _validated_big_thing_plan(bg)
        await push_plan_node(plan, 3, champion=bg.wolverine)
        resp = await execute_post_request(
            _plan_route(bg.alliance.id, plan.id, "/activate"), {}, headers=OWNER
        )
        assert resp.status_code == 409

    @pytest.mark.asyncio
    async def test_activating_demotes_the_previous_active_plan(self):
        bg = await setup_defense_bg()
        first = await _validated_big_thing_plan(bg, name="A")
        second = await _validated_big_thing_plan(bg, name="B")
        for plan in (first, second):
            resp = await execute_post_request(
                _plan_route(bg.alliance.id, plan.id, "/activate"), {}, headers=OWNER
            )
            assert resp.json()["is_active"] is True
        listing = await execute_get_request(
            _bg_route(bg.alliance.id, "/plans?format=big_thing"), headers=OWNER
        )
        active = [p["name"] for p in listing.json()["plans"] if p["is_active"]]
        assert active == ["B"]

    @pytest.mark.asyncio
    async def test_active_plan_that_turns_pending_stays_active_and_incomplete(self):
        bg = await setup_defense_bg()
        plan = await push_plan(bg.alliance.id, active=True)
        await push_plan_node(plan, 1, champion=bg.spider)
        body = (
            await execute_get_request(_plan_route(bg.alliance.id, plan.id), headers=OWNER)
        ).json()
        assert (body["is_active"], body["state"], body["is_incomplete"]) == (
            True,
            "incomplete",
            True,
        )

    @pytest.mark.asyncio
    async def test_deleting_the_active_plan_leaves_the_battlegroup_without_one(self):
        bg = await setup_defense_bg()
        plan = await push_plan(bg.alliance.id, active=True)
        deleted = await execute_delete_request(_plan_route(bg.alliance.id, plan.id), headers=OWNER)
        assert deleted.status_code == 204
        active = await execute_get_request(_bg_route(bg.alliance.id, "/active"), headers=MEMBER)
        assert active.json()["plan"] is None


class TestActivePlanView:
    @pytest.mark.asyncio
    async def test_member_sees_the_active_plan_of_the_current_format(self):
        bg = await setup_defense_bg()
        plan = await push_plan(bg.alliance.id, active=True)
        await push_plan_node(plan, 1, bg.owner_spider)
        resp = await execute_get_request(_bg_route(bg.alliance.id, "/active"), headers=MEMBER)
        body = resp.json()
        assert body["format"] == "regular"
        assert body["plan"]["nodes"][0]["champion_name"] == "Spider-Man"

    @pytest.mark.asyncio
    async def test_active_plan_of_the_other_format_is_hidden(self):
        bg = await setup_defense_bg()
        await push_plan(bg.alliance.id, fmt=BIG, active=True)
        resp = await execute_get_request(_bg_route(bg.alliance.id, "/active"), headers=MEMBER)
        assert resp.json()["plan"] is None

    @pytest.mark.asyncio
    async def test_member_cannot_read_a_plan_directly(self):
        bg = await setup_defense_bg()
        plan = await push_plan(bg.alliance.id, active=True)
        resp = await execute_get_request(_plan_route(bg.alliance.id, plan.id), headers=MEMBER)
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_visitor_reads_the_active_plan(self):
        await load_objects([get_generic_user(is_base_id=True)])
        await push_user2()
        alliance, _ = await push_alliance_with_owner()
        await push_visitor(alliance, user_id=USER2_ID, game_pseudo="Guest")
        resp = await execute_get_request(_bg_route(alliance.id, "/active"), headers=MEMBER)
        assert resp.status_code == 200
        assert resp.json()["plan"] is None

    @pytest.mark.asyncio
    async def test_plan_of_another_alliance_is_not_found(self):
        bg = await setup_defense_bg()
        foreign = await push_plan((await push_other_alliance()).id)
        for method, suffix in (
            (execute_get_request, ""),
            (execute_delete_request, ""),
        ):
            resp = await method(_plan_route(bg.alliance.id, foreign.id, suffix), headers=OWNER)
            assert resp.status_code == 404
        activate = await execute_post_request(
            _plan_route(bg.alliance.id, foreign.id, "/activate"), {}, headers=OWNER
        )
        assert activate.status_code == 404


class TestSaveAsTemplate:
    @pytest.mark.asyncio
    async def test_plan_saved_as_template_drops_the_players(self):
        bg = await setup_defense_bg()
        plan = await push_plan(bg.alliance.id)
        await push_plan_node(plan, 1, bg.owner_spider)
        await push_plan_node(plan, 4, champion=bg.wolverine)
        resp = await execute_post_request(
            _plan_route(bg.alliance.id, plan.id, "/template"), {"name": "From plan"}, headers=OWNER
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["format"] == "regular"
        assert [(n["node_number"], n["champion_name"]) for n in body["nodes"]] == [
            (1, "Spider-Man"),
            (4, "Wolverine"),
        ]

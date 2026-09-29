"""Integration tests for foreign (cross-alliance) ids never reaching a Defense Plan or Template."""

import uuid

import pytest

from tests.integration.endpoints.setup.defense_setup import (
    push_other_alliance,
    push_plan,
    push_template,
    setup_defense_bg,
)
from tests.integration.endpoints.setup.game_setup import (
    push_alliance_with_owner,
    push_champion_user,
)
from tests.utils.utils_client import (
    create_auth_headers,
    execute_post_request,
    execute_put_request,
    execute_request,
)
from tests.utils.utils_constant import USER_ID

OWNER = create_auth_headers(user_id=str(USER_ID))


def _plan_route(alliance_id, plan_id, suffix: str = "") -> str:
    return f"/alliances/{alliance_id}/defense/plans/{plan_id}{suffix}"


class TestForeignPlanId:
    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        ("method", "suffix", "make_payload"),
        [
            ("PUT", "/nodes/1", lambda bg: {"champion_id": str(bg.spider.id)}),
            ("DELETE", "/nodes/1", lambda _bg: None),
            ("DELETE", "/nodes", lambda _bg: None),
            ("GET", "/members", lambda _bg: None),
            ("GET", "/available-champions", lambda _bg: None),
            ("POST", "/template", lambda _bg: {"name": "From foreign"}),
            ("PATCH", "", lambda _bg: {"name": "Renamed"}),
        ],
    )
    async def test_foreign_plan_id_is_not_found(self, method, suffix, make_payload):
        bg = await setup_defense_bg()
        foreign = await push_plan((await push_other_alliance()).id)
        resp = await execute_request(
            method,
            _plan_route(bg.alliance.id, foreign.id, suffix),
            payload=make_payload(bg),
            headers=OWNER,
        )
        assert resp.status_code == 404


class TestForeignPlanCreationRefs:
    @pytest.mark.asyncio
    @pytest.mark.parametrize("field", ["template_id", "source_plan_id"])
    async def test_foreign_reference_is_not_found(self, field):
        bg = await setup_defense_bg()
        other_alliance_id = (await push_other_alliance()).id
        foreign_id = (
            (await push_template(other_alliance_id)).id
            if field == "template_id"
            else (await push_plan(other_alliance_id)).id
        )
        resp = await execute_post_request(
            f"/alliances/{bg.alliance.id}/defense/bg/1/plans",
            {"name": "A", "format": "regular", field: str(foreign_id)},
            headers=OWNER,
        )
        assert resp.status_code == 404


class TestForeignAllianceChampionUser:
    @pytest.mark.asyncio
    async def test_foreign_alliance_champion_user_is_refused(self):
        bg = await setup_defense_bg()
        _, outsider = await push_alliance_with_owner(
            user_id=uuid.uuid4(), game_pseudo="Outsider", alliance_name="Other", alliance_tag="OTH"
        )
        outsider_cu = await push_champion_user(outsider, bg.spider)
        plan = await push_plan(bg.alliance.id)
        resp = await execute_put_request(
            _plan_route(bg.alliance.id, plan.id, "/nodes/1"),
            {"champion_user_id": str(outsider_cu.id)},
            headers=OWNER,
        )
        assert resp.status_code == 400

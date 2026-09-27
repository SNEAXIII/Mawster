"""Integration tests for Defense Template endpoints."""

import uuid

import pytest

from src.enums.SeasonFormat import SeasonFormat
from tests.integration.endpoints.setup.defense_setup import (
    push_other_alliance,
    push_template,
    setup_defense_bg,
)
from tests.utils.utils_client import (
    create_auth_headers,
    execute_delete_request,
    execute_get_request,
    execute_patch_request,
    execute_post_request,
    execute_put_request,
)
from tests.utils.utils_constant import USER2_ID, USER_ID

OWNER = create_auth_headers(user_id=str(USER_ID))
MEMBER = create_auth_headers(user_id=str(USER2_ID))


def _templates(alliance_id, suffix: str = "") -> str:
    return f"/alliances/{alliance_id}/defense/templates{suffix}"


class TestTemplateLifecycle:
    @pytest.mark.asyncio
    async def test_create_empty_template_counts_against_its_format_quota(self):
        bg = await setup_defense_bg()
        resp = await execute_post_request(
            _templates(bg.alliance.id), {"name": "Rush", "format": "regular"}, headers=OWNER
        )
        assert resp.status_code == 201
        assert resp.json()["nodes"] == []
        assert resp.json()["node_count"] == 50

        regular = await execute_get_request(
            _templates(bg.alliance.id, "?format=regular"), headers=OWNER
        )
        assert regular.json()["quota"] == {"used": 1, "limit": 15}
        big = await execute_get_request(
            _templates(bg.alliance.id, "?format=big_thing"), headers=OWNER
        )
        assert big.json()["quota"]["used"] == 0

    @pytest.mark.asyncio
    async def test_sixteenth_template_of_a_format_is_refused(self):
        bg = await setup_defense_bg()
        for i in range(15):
            await push_template(bg.alliance.id, name=f"T{i}")
        refused = await execute_post_request(
            _templates(bg.alliance.id), {"name": "T15", "format": "regular"}, headers=OWNER
        )
        assert refused.status_code == 409
        other_format = await execute_post_request(
            _templates(bg.alliance.id), {"name": "T15", "format": "big_thing"}, headers=OWNER
        )
        assert other_format.status_code == 201

    @pytest.mark.asyncio
    async def test_name_is_unique_within_a_format(self):
        bg = await setup_defense_bg()
        await push_template(bg.alliance.id, name="Rush")
        same = await execute_post_request(
            _templates(bg.alliance.id), {"name": "Rush", "format": "regular"}, headers=OWNER
        )
        assert same.status_code == 409
        other = await execute_post_request(
            _templates(bg.alliance.id), {"name": "Rush", "format": "big_thing"}, headers=OWNER
        )
        assert other.status_code == 201

    @pytest.mark.asyncio
    async def test_duplicate_copies_the_champions(self):
        bg = await setup_defense_bg()
        source = await push_template(bg.alliance.id, champions={1: bg.spider, 7: bg.iron_man})
        resp = await execute_post_request(
            _templates(bg.alliance.id),
            {"name": "Copy", "format": "regular", "source_template_id": str(source.id)},
            headers=OWNER,
        )
        assert resp.status_code == 201
        nodes = [(n["node_number"], n["champion_name"]) for n in resp.json()["nodes"]]
        assert nodes == [(1, "Spider-Man"), (7, "Iron Man")]

    @pytest.mark.asyncio
    async def test_duplicate_across_formats_is_refused(self):
        bg = await setup_defense_bg()
        source = await push_template(bg.alliance.id)
        resp = await execute_post_request(
            _templates(bg.alliance.id),
            {"name": "Copy", "format": "big_thing", "source_template_id": str(source.id)},
            headers=OWNER,
        )
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_rename_then_delete(self):
        bg = await setup_defense_bg()
        template = await push_template(bg.alliance.id)
        renamed = await execute_patch_request(
            _templates(bg.alliance.id, f"/{template.id}"), {"name": "New"}, headers=OWNER
        )
        assert renamed.json()["name"] == "New"
        deleted = await execute_delete_request(
            _templates(bg.alliance.id, f"/{template.id}"), headers=OWNER
        )
        assert deleted.status_code == 204
        gone = await execute_get_request(
            _templates(bg.alliance.id, f"/{template.id}"), headers=OWNER
        )
        assert gone.status_code == 404


class TestTemplateNodes:
    @pytest.mark.asyncio
    async def test_place_a_champion_nobody_is_assigned_to(self):
        bg = await setup_defense_bg()
        template = await push_template(bg.alliance.id)
        resp = await execute_put_request(
            _templates(bg.alliance.id, f"/{template.id}/nodes/12"),
            {"champion_id": str(bg.wolverine.id)},
            headers=OWNER,
        )
        assert resp.status_code == 200
        assert [(n["node_number"], n["champion_name"]) for n in resp.json()["nodes"]] == [
            (12, "Wolverine")
        ]

    @pytest.mark.asyncio
    async def test_same_champion_on_another_node_is_refused(self):
        bg = await setup_defense_bg()
        template = await push_template(bg.alliance.id, champions={1: bg.spider})
        body = {"champion_id": str(bg.spider.id)}
        other = await execute_put_request(
            _templates(bg.alliance.id, f"/{template.id}/nodes/2"), body, headers=OWNER
        )
        assert other.status_code == 409
        same = await execute_put_request(
            _templates(bg.alliance.id, f"/{template.id}/nodes/1"), body, headers=OWNER
        )
        assert same.status_code == 200

    @pytest.mark.asyncio
    async def test_node_beyond_the_format_map_is_refused(self):
        bg = await setup_defense_bg()
        template = await push_template(bg.alliance.id, fmt=SeasonFormat.big_thing)
        resp = await execute_put_request(
            _templates(bg.alliance.id, f"/{template.id}/nodes/11"),
            {"champion_id": str(bg.spider.id)},
            headers=OWNER,
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_unknown_champion_is_refused(self):
        bg = await setup_defense_bg()
        template = await push_template(bg.alliance.id)
        resp = await execute_put_request(
            _templates(bg.alliance.id, f"/{template.id}/nodes/1"),
            {"champion_id": str(uuid.uuid4())},
            headers=OWNER,
        )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_remove_node(self):
        bg = await setup_defense_bg()
        template = await push_template(bg.alliance.id, champions={3: bg.spider})
        route = _templates(bg.alliance.id, f"/{template.id}/nodes/3")
        assert (await execute_delete_request(route, headers=OWNER)).status_code == 204
        assert (await execute_delete_request(route, headers=OWNER)).status_code == 404


class TestTemplateAccess:
    @pytest.mark.asyncio
    async def test_plain_member_cannot_read_templates(self):
        bg = await setup_defense_bg()
        resp = await execute_get_request(
            _templates(bg.alliance.id, "?format=regular"), headers=MEMBER
        )
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_template_of_another_alliance_is_not_found(self):
        bg = await setup_defense_bg()
        foreign = await push_template((await push_other_alliance()).id, champions={1: bg.spider})
        base = _templates(bg.alliance.id, f"/{foreign.id}")
        assert (await execute_get_request(base, headers=OWNER)).status_code == 404
        put = await execute_put_request(
            f"{base}/nodes/2", {"champion_id": str(bg.iron_man.id)}, headers=OWNER
        )
        assert put.status_code == 404
        assert (await execute_delete_request(base, headers=OWNER)).status_code == 404

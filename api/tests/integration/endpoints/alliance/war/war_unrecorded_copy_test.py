"""Unrecorded Copy: a Synergy Carrier or Prefight the player owns off-site."""

import uuid

import pytest

from src.enums.SeasonFormat import SeasonFormat
from src.enums.SeasonStatus import SeasonStatus
from src.enums.WarStatus import WarStatus
from src.Messages.war_messages import CHAMPION_NOT_IN_ALLIANCE_BG, PREFIGHT_ENTRY_NOT_FOUND
from src.models.war.Season import Season
from src.models.war.War import War
from tests.integration.endpoints.alliance.war.war_prefight_test import (
    _occupy_node_6,
    _prefight_url,
    _setup_prefight_scenario,
    _war_banning,
)
from tests.integration.endpoints.alliance.war.war_synergy_test import (
    _setup_synergy_scenario,
    _synergy_url,
)
from tests.integration.endpoints.setup.defense_setup import push_plan, push_plan_node
from tests.integration.endpoints.setup.game_setup import push_champion, push_champion_user
from tests.utils.utils_client import (
    execute_delete_request,
    execute_get_request,
    execute_patch_request,
    execute_post_request,
)
from tests.utils.utils_db import load_objects


async def _defend(data, champion_user, node=3):
    plan = await push_plan(data["alliance"].id, battlegroup=1, active=True)
    await push_plan_node(plan, node, champion_user)


def _unrecorded_prefight(data, champion, node=5, account=None):
    return {
        "champion_id": str(champion.id),
        "game_account_id": str((account or data["member"]).id),
        "target_node_number": node,
    }


def _unrecorded_synergy(data, champion_id):
    return {
        "champion_id": str(champion_id),
        "target_champion_user_id": str(data["attacker_cu"].id),
    }


async def _add_unrecorded_prefight(data):
    """Return the prefight URL and the created Unrecorded Copy's response."""
    absent = await push_champion(name="Magik", champion_class="Mystic", has_prefight=True)
    url = _prefight_url(data["alliance"].id, data["war"].id)
    created = await execute_post_request(
        url, payload=_unrecorded_prefight(data, absent), headers=data["headers_member"]
    )
    assert created.status_code == 201
    return url, created


async def _add_unrecorded_synergy(data):
    """Return the synergy URL and the created Unrecorded Copy's response."""
    absent = await push_champion(name="Magik", champion_class="Mystic")
    url = _synergy_url(data["alliance"].id, data["war"].id)
    created = await execute_post_request(
        url, payload=_unrecorded_synergy(data, absent.id), headers=data["headers_member"]
    )
    assert created.status_code == 201
    return url, created


def _available(data, war_id=None, prefight=False, include=True):
    kind = "available-prefight-attackers" if prefight else "available-attackers"
    query = "?include_defense=true" if include else ""
    return f"/alliances/{data['alliance'].id}/wars/{war_id or data['war'].id}/bg/1/{kind}{query}"


async def _flags(data, **kwargs) -> dict[str, bool]:
    resp = await execute_get_request(_available(data, **kwargs), headers=data["headers_member"])
    assert resp.status_code == 200
    return {item["champion_user_id"]: item["is_on_defense"] for item in resp.json()}


class TestUnrecordedPrefight:
    @pytest.mark.asyncio
    async def test_not_in_roster_is_accepted_and_flagged(self):
        data = await _setup_prefight_scenario()
        absent = await push_champion(name="Magik", champion_class="Mystic", has_prefight=True)
        resp = await execute_post_request(
            _prefight_url(data["alliance"].id, data["war"].id),
            payload=_unrecorded_prefight(data, absent),
            headers=data["headers_member"],
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["champion_user_id"] is None
        assert body["champion_id"] == str(absent.id)
        assert body["rarity"] is None
        assert body["unrecorded_reason"] == "not_in_roster"

    @pytest.mark.asyncio
    async def test_defender_is_accepted_and_flagged_on_defense(self):
        data = await _setup_prefight_scenario()
        await _defend(data, data["prefight_cu"])
        resp = await execute_post_request(
            _prefight_url(data["alliance"].id, data["war"].id),
            payload=_unrecorded_prefight(data, data["prefight_champ"]),
            headers=data["headers_member"],
        )
        assert resp.status_code == 201
        assert resp.json()["unrecorded_reason"] == "on_defense"

    @pytest.mark.asyncio
    async def test_rejected_when_a_recorded_copy_is_free(self):
        data = await _setup_prefight_scenario()
        resp = await execute_post_request(
            _prefight_url(data["alliance"].id, data["war"].id),
            payload=_unrecorded_prefight(data, data["prefight_champ"]),
            headers=data["headers_member"],
        )
        assert resp.status_code == 409

    @pytest.mark.asyncio
    async def test_defender_sent_by_roster_entry_still_rejected(self):
        data = await _setup_prefight_scenario()
        await _defend(data, data["prefight_cu"])
        resp = await execute_post_request(
            _prefight_url(data["alliance"].id, data["war"].id),
            payload={"champion_user_id": str(data["prefight_cu"].id), "target_node_number": 5},
            headers=data["headers_member"],
        )
        assert resp.status_code == 409

    @pytest.mark.asyncio
    async def test_without_prefight_ability_rejected(self):
        data = await _setup_prefight_scenario()
        plain = await push_champion(name="Hulk", champion_class="Science")
        resp = await execute_post_request(
            _prefight_url(data["alliance"].id, data["war"].id),
            payload=_unrecorded_prefight(data, plain),
            headers=data["headers_member"],
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "payload",
        [
            {"target_node_number": 5},
            {"target_node_number": 5, "champion_id": "00000000-0000-0000-0000-000000000001"},
        ],
    )
    async def test_malformed_body_rejected(self, payload):
        data = await _setup_prefight_scenario()
        resp = await execute_post_request(
            _prefight_url(data["alliance"].id, data["war"].id),
            payload=payload,
            headers=data["headers_member"],
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_duplicate_on_same_node_rejected(self):
        data = await _setup_prefight_scenario()
        absent = await push_champion(name="Magik", champion_class="Mystic", has_prefight=True)
        url = _prefight_url(data["alliance"].id, data["war"].id)
        payload = _unrecorded_prefight(data, absent)
        assert (
            await execute_post_request(url, payload=payload, headers=data["headers_member"])
        ).status_code == 201
        resp = await execute_post_request(url, payload=payload, headers=data["headers_member"])
        assert resp.status_code == 409

    @pytest.mark.asyncio
    async def test_two_nodes_take_one_quota_slot(self):
        """Member holds 1 node attacker; one Unrecorded Copy on 2 nodes → 2 slots of 3."""
        data = await _setup_prefight_scenario()
        absent = await push_champion(name="Magik", champion_class="Mystic", has_prefight=True)
        await _occupy_node_6(data)
        url = _prefight_url(data["alliance"].id, data["war"].id)
        for node in (5, 6):
            resp = await execute_post_request(
                url,
                payload=_unrecorded_prefight(data, absent, node),
                headers=data["headers_member"],
            )
            assert resp.status_code == 201
        # third distinct slot still fits
        resp = await execute_post_request(
            url,
            payload={"champion_user_id": str(data["prefight_cu"].id), "target_node_number": 5},
            headers=data["headers_member"],
        )
        assert resp.status_code == 201

    @pytest.mark.asyncio
    async def test_banned_champion_rejected(self):
        data = await _setup_prefight_scenario()
        absent = await push_champion(name="Magik", champion_class="Mystic", has_prefight=True)
        war_id = await _war_banning(data, absent.id)
        resp = await execute_post_request(
            _prefight_url(data["alliance"].id, war_id),
            payload=_unrecorded_prefight(data, absent),
            headers=data["headers_member"],
        )
        assert resp.status_code == 409

    @pytest.mark.asyncio
    async def test_remove_by_entry_id(self):
        data = await _setup_prefight_scenario()
        url, created = await _add_unrecorded_prefight(data)
        resp = await execute_delete_request(
            f"{url}/{created.json()['id']}", headers=data["headers_member"]
        )
        assert resp.status_code == 204
        assert (await execute_get_request(url, headers=data["headers_member"])).json() == []

    @pytest.mark.asyncio
    async def test_remove_through_another_battlegroup_not_found(self):
        data = await _setup_prefight_scenario()
        _, created = await _add_unrecorded_prefight(data)
        other_bg = _prefight_url(data["alliance"].id, data["war"].id, battlegroup=2)
        resp = await execute_delete_request(
            f"{other_bg}/{created.json()['id']}", headers=data["headers_member"]
        )
        assert resp.status_code == 404
        assert resp.json()["message"] == PREFIGHT_ENTRY_NOT_FOUND

    @pytest.mark.asyncio
    async def test_reason_follows_the_active_plan_at_read_time(self):
        data = await _setup_prefight_scenario()
        await _defend(data, data["prefight_cu"])
        url = _prefight_url(data["alliance"].id, data["war"].id)
        await execute_post_request(
            url,
            payload=_unrecorded_prefight(data, data["prefight_champ"]),
            headers=data["headers_member"],
        )
        listed = (await execute_get_request(url, headers=data["headers_member"])).json()
        assert listed[0]["unrecorded_reason"] == "on_defense"

    @pytest.mark.asyncio
    async def test_account_outside_the_battlegroup_rejected(self):
        data = await _setup_prefight_scenario()
        await execute_patch_request(
            f"/alliances/{data['alliance'].id}/members/{data['member'].id}/group",
            payload={"group": 2},
            headers=data["headers_owner"],
        )
        absent = await push_champion(name="Magik", champion_class="Mystic", has_prefight=True)
        resp = await execute_post_request(
            _prefight_url(data["alliance"].id, data["war"].id),
            payload=_unrecorded_prefight(data, absent),
            headers=data["headers_owner"],
        )
        assert resp.status_code == 403
        assert resp.json()["message"] == CHAMPION_NOT_IN_ALLIANCE_BG

    @pytest.mark.asyncio
    async def test_defender_still_refused_as_node_attacker(self):
        data = await _setup_prefight_scenario()
        await _defend(data, data["prefight_cu"])
        resp = await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/1/node/5/attacker",
            payload={"champion_user_id": str(data["prefight_cu"].id)},
            headers=data["headers_member"],
        )
        assert resp.status_code == 409


class TestUnrecordedSynergy:
    @pytest.mark.asyncio
    async def test_not_in_roster_uses_target_account(self):
        data = await _setup_synergy_scenario()
        _, created = await _add_unrecorded_synergy(data)
        body = created.json()
        assert body["game_account_id"] == str(data["member"].id)
        assert body["unrecorded_reason"] == "not_in_roster"

    @pytest.mark.asyncio
    async def test_defender_flagged_on_defense(self):
        data = await _setup_synergy_scenario()
        await _defend(data, data["synergy_cu"])
        resp = await execute_post_request(
            _synergy_url(data["alliance"].id, data["war"].id),
            payload=_unrecorded_synergy(data, data["synergy_cu"].champion_id),
            headers=data["headers_member"],
        )
        assert resp.status_code == 201
        assert resp.json()["unrecorded_reason"] == "on_defense"

    @pytest.mark.asyncio
    async def test_same_champion_as_target_rejected(self):
        data = await _setup_synergy_scenario()
        resp = await execute_post_request(
            _synergy_url(data["alliance"].id, data["war"].id),
            payload=_unrecorded_synergy(data, data["attacker_cu"].champion_id),
            headers=data["headers_member"],
        )
        assert resp.status_code == 409

    @pytest.mark.asyncio
    async def test_free_recorded_copy_rejected(self):
        data = await _setup_synergy_scenario()
        resp = await execute_post_request(
            _synergy_url(data["alliance"].id, data["war"].id),
            payload=_unrecorded_synergy(data, data["synergy_cu"].champion_id),
            headers=data["headers_member"],
        )
        assert resp.status_code == 409

    @pytest.mark.asyncio
    async def test_removing_the_target_attacker_cascades(self):
        data = await _setup_synergy_scenario()
        url, _ = await _add_unrecorded_synergy(data)
        await execute_delete_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/1/node/10/attacker",
            headers=data["headers_member"],
        )
        assert (await execute_get_request(url, headers=data["headers_member"])).json() == []

    @pytest.mark.asyncio
    async def test_remove_by_entry_id(self):
        data = await _setup_synergy_scenario()
        url, created = await _add_unrecorded_synergy(data)
        resp = await execute_delete_request(
            f"{url}/{created.json()['id']}", headers=data["headers_member"]
        )
        assert resp.status_code == 204


class TestAvailableWithDefense:
    @pytest.mark.asyncio
    @pytest.mark.parametrize("prefight", [False, True])
    async def test_active_plan_defender_flagged(self, prefight):
        data = await _setup_prefight_scenario()
        await _defend(data, data["prefight_cu"])
        assert (await _flags(data, prefight=prefight))[str(data["prefight_cu"].id)] is True

    @pytest.mark.asyncio
    @pytest.mark.parametrize("prefight", [False, True])
    async def test_default_still_excludes_defenders(self, prefight):
        data = await _setup_prefight_scenario()
        await _defend(data, data["prefight_cu"])
        flags = await _flags(data, prefight=prefight, include=False)
        assert str(data["prefight_cu"].id) not in flags

    @pytest.mark.asyncio
    async def test_inactive_plan_does_not_flag(self):
        data = await _setup_prefight_scenario()
        plan = await push_plan(data["alliance"].id, battlegroup=1, active=False)
        await push_plan_node(plan, 3, data["prefight_cu"])
        assert (await _flags(data))[str(data["prefight_cu"].id)] is False

    @pytest.mark.asyncio
    async def test_other_format_does_not_flag(self):
        data = await _setup_prefight_scenario()
        plan = await push_plan(
            data["alliance"].id, battlegroup=1, fmt=SeasonFormat.BIG_THING, active=True
        )
        await push_plan_node(plan, 3, data["prefight_cu"])
        assert (await _flags(data))[str(data["prefight_cu"].id)] is False

    @pytest.mark.asyncio
    async def test_other_battlegroup_does_not_flag(self):
        data = await _setup_prefight_scenario()
        plan = await push_plan(data["alliance"].id, battlegroup=2, active=True)
        await push_plan_node(plan, 3, data["prefight_cu"])
        assert (await _flags(data))[str(data["prefight_cu"].id)] is False

    @pytest.mark.asyncio
    async def test_closed_war_uses_its_season_format(self):
        data = await _setup_prefight_scenario()
        season = Season(
            id=uuid.uuid4(), number=1, status=SeasonStatus.ENDED, format=SeasonFormat.BIG_THING
        )
        closed = War(
            id=uuid.uuid4(),
            alliance_id=data["alliance"].id,
            opponent_name="Old",
            created_by_id=data["owner"].id,
            season_id=season.id,
            status=WarStatus.ENDED,
        )
        await load_objects([season, closed])
        plan = await push_plan(
            data["alliance"].id, battlegroup=1, fmt=SeasonFormat.BIG_THING, active=True
        )
        await push_plan_node(plan, 3, data["prefight_cu"])
        flags = await _flags(data, war_id=closed.id)
        assert flags[str(data["prefight_cu"].id)] is True

    @pytest.mark.asyncio
    async def test_prefight_dedup_prefers_the_free_copy(self):
        """7 stars on defense + 6 stars free: the free copy stands for the champion."""
        data = await _setup_prefight_scenario()
        await _defend(data, data["prefight_cu"])
        lower = await push_champion_user(data["member"], data["prefight_champ"], stars=6, rank=5)
        flags = await _flags(data, prefight=True)
        assert flags.get(str(lower.id)) is False
        assert str(data["prefight_cu"].id) not in flags

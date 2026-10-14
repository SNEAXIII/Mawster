"""Unrecorded Copy: a Synergy Carrier or Prefight the player owns off-site."""

import pytest

from tests.integration.endpoints.alliance.war.war_prefight_test import (
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
    execute_post_request,
)


async def _defend(data, champion_user, node=3):
    plan = await push_plan(data["alliance"].id, battlegroup=1, active=True)
    await push_plan_node(plan, node, champion_user)


def _unrecorded_prefight(data, champion, node=5, account=None):
    return {
        "champion_id": str(champion.id),
        "game_account_id": str((account or data["member"]).id),
        "target_node_number": node,
    }


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
        alliance_id, war_id = data["alliance"].id, data["war"].id
        second_defender = await push_champion(name="Hulk", champion_class="Science")
        await execute_post_request(
            f"/alliances/{alliance_id}/wars/{war_id}/bg/1/place",
            payload={
                "node_number": 6,
                "champion_id": str(second_defender.id),
                "stars": 7,
                "rank": 3,
                "ascension": 0,
            },
            headers=data["headers_owner"],
        )
        cyclops = await push_champion(name="Cyclops", champion_class="Mutant")
        owner_cu = await push_champion_user(data["owner"], cyclops, stars=7, rank=3)
        await execute_post_request(
            f"/alliances/{alliance_id}/wars/{war_id}/bg/1/node/6/attacker",
            payload={"champion_user_id": str(owner_cu.id)},
            headers=data["headers_owner"],
        )
        url = _prefight_url(alliance_id, war_id)
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
        absent = await push_champion(name="Magik", champion_class="Mystic", has_prefight=True)
        url = _prefight_url(data["alliance"].id, data["war"].id)
        created = await execute_post_request(
            url, payload=_unrecorded_prefight(data, absent), headers=data["headers_member"]
        )
        resp = await execute_delete_request(
            f"{url}/{created.json()['id']}", headers=data["headers_member"]
        )
        assert resp.status_code == 204
        assert (await execute_get_request(url, headers=data["headers_member"])).json() == []

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


class TestUnrecordedSynergy:
    @pytest.mark.asyncio
    async def test_not_in_roster_uses_target_account(self):
        data = await _setup_synergy_scenario()
        absent = await push_champion(name="Magik", champion_class="Mystic")
        resp = await execute_post_request(
            _synergy_url(data["alliance"].id, data["war"].id),
            payload={
                "champion_id": str(absent.id),
                "target_champion_user_id": str(data["attacker_cu"].id),
            },
            headers=data["headers_member"],
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["game_account_id"] == str(data["member"].id)
        assert body["unrecorded_reason"] == "not_in_roster"

    @pytest.mark.asyncio
    async def test_defender_flagged_on_defense(self):
        data = await _setup_synergy_scenario()
        await _defend(data, data["synergy_cu"])
        resp = await execute_post_request(
            _synergy_url(data["alliance"].id, data["war"].id),
            payload={
                "champion_id": str(data["synergy_cu"].champion_id),
                "target_champion_user_id": str(data["attacker_cu"].id),
            },
            headers=data["headers_member"],
        )
        assert resp.status_code == 201
        assert resp.json()["unrecorded_reason"] == "on_defense"

    @pytest.mark.asyncio
    async def test_same_champion_as_target_rejected(self):
        data = await _setup_synergy_scenario()
        resp = await execute_post_request(
            _synergy_url(data["alliance"].id, data["war"].id),
            payload={
                "champion_id": str(data["attacker_cu"].champion_id),
                "target_champion_user_id": str(data["attacker_cu"].id),
            },
            headers=data["headers_member"],
        )
        assert resp.status_code == 409

    @pytest.mark.asyncio
    async def test_free_recorded_copy_rejected(self):
        data = await _setup_synergy_scenario()
        resp = await execute_post_request(
            _synergy_url(data["alliance"].id, data["war"].id),
            payload={
                "champion_id": str(data["synergy_cu"].champion_id),
                "target_champion_user_id": str(data["attacker_cu"].id),
            },
            headers=data["headers_member"],
        )
        assert resp.status_code == 409

    @pytest.mark.asyncio
    async def test_removing_the_target_attacker_cascades(self):
        data = await _setup_synergy_scenario()
        absent = await push_champion(name="Magik", champion_class="Mystic")
        url = _synergy_url(data["alliance"].id, data["war"].id)
        await execute_post_request(
            url,
            payload={
                "champion_id": str(absent.id),
                "target_champion_user_id": str(data["attacker_cu"].id),
            },
            headers=data["headers_member"],
        )
        await execute_delete_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/1/node/10/attacker",
            headers=data["headers_member"],
        )
        assert (await execute_get_request(url, headers=data["headers_member"])).json() == []

    @pytest.mark.asyncio
    async def test_remove_by_entry_id(self):
        data = await _setup_synergy_scenario()
        absent = await push_champion(name="Magik", champion_class="Mystic")
        url = _synergy_url(data["alliance"].id, data["war"].id)
        created = await execute_post_request(
            url,
            payload={
                "champion_id": str(absent.id),
                "target_champion_user_id": str(data["attacker_cu"].id),
            },
            headers=data["headers_member"],
        )
        resp = await execute_delete_request(
            f"{url}/{created.json()['id']}", headers=data["headers_member"]
        )
        assert resp.status_code == 204

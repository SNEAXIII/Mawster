"""DELETE /bg/{bg}/attackers — detach the Attackers of every unfinished War Node."""

import pytest
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.enums.WarBoost import WarBoost
from src.models.war.WarDefensePlacement import WarDefensePlacement
from src.models.war.WarPrefightAttacker import WarPrefightAttacker
from src.models.war.WarSynergyAttacker import WarSynergyAttacker
from tests.integration.endpoints.setup.game_setup import (
    push_champion,
    push_champion_user,
    push_strategist,
)
from tests.integration.endpoints.setup.war_setup import (
    _setup_attacker_scenario,
    _setup_closed_war_scenario,
)
from tests.utils.utils_client import create_auth_headers, execute_delete_request
from tests.utils.utils_constant import USER2_ID, USER_ID
from tests.utils.utils_db import load_objects, sqlite_async_engine

OWNER = create_auth_headers(user_id=str(USER_ID))
MEMBER = create_auth_headers(user_id=str(USER2_ID))


def _url(data) -> str:
    return f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/1/attackers"


async def _seed(data) -> dict:
    """Node 10 completed (attacker A), node 11 unfinished (B), node 12 unfinished (A)."""
    member, war = data["member"], data["war"]
    a = data["champion_user"]
    b_champ = await push_champion(name="Hulk", champion_class="Science")
    b = await push_champion_user(member, b_champ)
    assist_champ = await push_champion(name="Thor", champion_class="Cosmic")
    assist = await push_champion_user(member, assist_champ)
    s1_champ = await push_champion(name="Deadpool", champion_class="Mutant")
    s1 = await push_champion_user(member, s1_champ)
    s2_champ = await push_champion(name="Quake", champion_class="Science")
    s2 = await push_champion_user(member, s2_champ)

    async with AsyncSession(sqlite_async_engine) as session:
        node10 = (
            await session.exec(
                select(WarDefensePlacement).where(
                    WarDefensePlacement.war_id == war.id, WarDefensePlacement.node_number == 10
                )
            )
        ).one()
        node10.attacker_champion_user_id = a.id
        node10.assist_champion_user_id = assist.id
        node10.ko_count = 2
        node10.is_combat_completed = True
        session.add(node10)
        await session.commit()

    def node(number, attacker):
        return WarDefensePlacement(
            war_id=war.id,
            battlegroup=1,
            node_number=number,
            champion_id=data["champ"].id,
            stars=7,
            rank=3,
            attacker_champion_user_id=attacker.id,
            assist_champion_user_id=assist.id,
            ko_count=1,
            war_boost=next(iter(WarBoost)),
            has_defense_boost=True,
            has_power_boost=True,
            has_specials_boost=True,
        )

    def synergy(cu, champ, target):
        return WarSynergyAttacker(
            war_id=war.id,
            battlegroup=1,
            game_account_id=member.id,
            champion_id=champ.id,
            champion_user_id=cu.id,
            target_champion_user_id=target.id,
        )

    def prefight(target_node):
        return WarPrefightAttacker(
            war_id=war.id,
            battlegroup=1,
            game_account_id=member.id,
            champion_id=s2_champ.id,
            champion_user_id=s2.id,
            target_node_number=target_node,
        )

    syn_a, syn_b = synergy(s1, s1_champ, a), synergy(s2, s2_champ, b)
    pf_done, pf_open = prefight(10), prefight(11)
    await load_objects([node(11, b), node(12, a), syn_a, syn_b, pf_done, pf_open])
    return {"syn_a": syn_a, "syn_b": syn_b, "pf_done": pf_done, "pf_open": pf_open}


async def _placements(war_id) -> dict[int, WarDefensePlacement]:
    async with AsyncSession(sqlite_async_engine) as session:
        rows = await session.exec(
            select(WarDefensePlacement).where(WarDefensePlacement.war_id == war_id)
        )
        return {p.node_number: p for p in rows.all()}


async def _ids(model, war_id) -> set:
    async with AsyncSession(sqlite_async_engine) as session:
        rows = await session.exec(select(model).where(model.war_id == war_id))
        return {r.id for r in rows.all()}


class TestClearUnfinishedAttackers:
    @pytest.mark.asyncio
    async def test_strategist_clears_unfinished_nodes(self):
        data = await _setup_attacker_scenario()
        seeded = await _seed(data)
        await push_strategist(data["alliance"], data["member"])

        response = await execute_delete_request(_url(data), headers=MEMBER)

        assert response.status_code == 200
        assert response.json() == {"cleared": 2}
        nodes = await _placements(data["war"].id)
        assert set(nodes) == {10, 11, 12}
        done = nodes[10]
        assert done.attacker_champion_user_id == data["champion_user"].id
        assert done.assist_champion_user_id is not None
        assert done.ko_count == 2
        for number in (11, 12):
            p = nodes[number]
            assert p.attacker_champion_user_id is None
            assert p.assist_champion_user_id is None
            assert p.ko_count == 0
            assert p.war_boost is None
            assert not p.has_defense_boost
            assert not p.has_power_boost
            assert not p.has_specials_boost
        assert await _ids(WarPrefightAttacker, data["war"].id) == {seeded["pf_done"].id}
        assert await _ids(WarSynergyAttacker, data["war"].id) == {seeded["syn_a"].id}

    @pytest.mark.asyncio
    async def test_plain_member_forbidden(self):
        data = await _setup_attacker_scenario()
        await _seed(data)

        response = await execute_delete_request(_url(data), headers=MEMBER)

        assert response.status_code == 403
        assert (await _placements(data["war"].id))[11].attacker_champion_user_id is not None

    @pytest.mark.asyncio
    async def test_closed_war_conflicts(self):
        data = await _setup_closed_war_scenario()

        response = await execute_delete_request(f"{data['base']}/bg/1/attackers", headers=OWNER)

        assert response.status_code == 409

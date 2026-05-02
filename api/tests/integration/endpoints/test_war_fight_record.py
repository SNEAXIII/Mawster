"""Integration tests for war fight record snapshot and knowledge base."""

import uuid
import pytest

from tests.utils.utils_client import create_auth_headers, execute_post_request, execute_patch_request
from tests.utils.utils_constant import USER_ID, USER2_ID, GAME_PSEUDO, GAME_PSEUDO_2, ALLIANCE_NAME, ALLIANCE_TAG
from tests.integration.endpoints.setup.game_setup import (
    push_alliance_with_owner, push_member, push_officer, push_champion, push_champion_user,
)
from tests.integration.endpoints.setup.user_setup import get_generic_user, push_user2
from tests.utils.utils_db import load_objects
from src.models.War import War
from src.models.WarDefensePlacement import WarDefensePlacement
from src.models.WarFightRecord import WarFightRecord
from sqlmodel import select

OPPONENT = "Enemy Alliance"


async def _setup_war_with_fight():
    """Alliance + war + node 10 BG1 with defender and attacker assigned."""
    await load_objects([get_generic_user(is_base_id=True)])
    await push_user2()

    alliance, owner = await push_alliance_with_owner(
        user_id=USER_ID, game_pseudo=GAME_PSEUDO,
        alliance_name=ALLIANCE_NAME, alliance_tag=ALLIANCE_TAG,
    )
    await push_officer(alliance, owner)
    member = await push_member(alliance, user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)

    headers_owner = create_auth_headers(user_id=str(USER_ID))

    await execute_patch_request(
        f"/alliances/{alliance.id}/members/{owner.id}/group",
        payload={"group": 1}, headers=headers_owner,
    )
    await execute_patch_request(
        f"/alliances/{alliance.id}/members/{member.id}/group",
        payload={"group": 1}, headers=headers_owner,
    )

    from src.models.Champion import Champion
    from src.models.ChampionUser import ChampionUser
    defender_champ = Champion(name="Thanos", champion_class="Cosmic")
    attacker_champ = Champion(name="Spider-Man", champion_class="Science", is_saga_attacker=True)
    attacker_cu = ChampionUser(
        game_account_id=member.id, champion_id=attacker_champ.id,
        stars=7, rank=4, ascension=0,
    )
    await load_objects([defender_champ, attacker_champ, attacker_cu])

    war = War(
        id=uuid.uuid4(), alliance_id=alliance.id,
        opponent_name=OPPONENT, created_by_id=owner.id,
    )
    placement = WarDefensePlacement(
        war_id=war.id, battlegroup=1, node_number=10,
        champion_id=defender_champ.id, stars=6, rank=3, ascension=0,
        attacker_champion_user_id=attacker_cu.id,
        ko_count=1, is_combat_completed=False,
    )
    await load_objects([war, placement])

    return {
        "alliance": alliance, "owner": owner, "member": member,
        "war": war, "placement": placement, "attacker_cu": attacker_cu,
        "attacker_champ": attacker_champ, "defender_champ": defender_champ,
    }


class TestWarFightRecordSnapshot:
    @pytest.mark.asyncio
    async def test_end_war_creates_fight_record(self, session):
        data = await _setup_war_with_fight()
        headers = create_auth_headers(user_id=str(USER_ID))

        response = await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/end",
            payload={"win": True, "elo_change": 50},
            headers=headers,
        )
        assert response.status_code == 200

        records = (await session.exec(
            select(WarFightRecord).where(WarFightRecord.war_id == data["war"].id)
        )).all()
        assert len(records) == 1
        r = records[0]
        assert r.node_number == 10
        assert r.battlegroup == 1
        assert r.champion_id == data["attacker_champ"].id
        assert r.stars == 7
        assert r.rank == 4
        assert r.is_saga_attacker is True
        assert r.defender_champion_id == data["defender_champ"].id
        assert r.defender_stars == 6
        assert r.ko_count == 1
        assert r.alliance_id == data["alliance"].id

    @pytest.mark.asyncio
    async def test_end_war_skips_node_without_attacker(self, session):
        """Nodes without an attacker assigned must not produce a fight record."""
        await load_objects([get_generic_user(is_base_id=True)])
        alliance, owner = await push_alliance_with_owner(
            user_id=USER_ID, game_pseudo=GAME_PSEUDO,
            alliance_name=ALLIANCE_NAME, alliance_tag=ALLIANCE_TAG,
        )
        await push_officer(alliance, owner)
        defender_champ = await push_champion(name="Hulk", champion_class="Science")
        war = War(
            id=uuid.uuid4(), alliance_id=alliance.id,
            opponent_name=OPPONENT, created_by_id=owner.id,
        )
        placement = WarDefensePlacement(
            war_id=war.id, battlegroup=1, node_number=5,
            champion_id=defender_champ.id, stars=6, rank=3, ascension=0,
        )
        await load_objects([war, placement])

        headers = create_auth_headers(user_id=str(USER_ID))
        response = await execute_post_request(
            f"/alliances/{alliance.id}/wars/{war.id}/end",
            payload={"win": False, "elo_change": None},
            headers=headers,
        )
        assert response.status_code == 200

        records = (await session.exec(
            select(WarFightRecord).where(WarFightRecord.war_id == war.id)
        )).all()
        assert len(records) == 0

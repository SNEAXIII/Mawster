"""Integration tests for war fight record snapshot and knowledge base."""

import uuid
import pytest

from tests.utils.utils_client import (
    create_auth_headers,
    execute_post_request,
    execute_patch_request,
    execute_get_request,
)
from tests.utils.utils_constant import (
    USER_ID,
    USER2_ID,
    GAME_PSEUDO,
    GAME_PSEUDO_2,
    ALLIANCE_NAME,
    ALLIANCE_TAG,
)
from src.enums.Roles import Roles
from tests.integration.endpoints.setup.game_setup import (
    push_alliance_with_owner,
    push_member,
    push_officer,
    push_champion,
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
        user_id=USER_ID,
        game_pseudo=GAME_PSEUDO,
        alliance_name=ALLIANCE_NAME,
        alliance_tag=ALLIANCE_TAG,
    )
    await push_officer(alliance, owner)
    member = await push_member(alliance, user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)

    headers_owner = create_auth_headers(user_id=str(USER_ID))

    await execute_patch_request(
        f"/alliances/{alliance.id}/members/{owner.id}/group",
        payload={"group": 1},
        headers=headers_owner,
    )
    await execute_patch_request(
        f"/alliances/{alliance.id}/members/{member.id}/group",
        payload={"group": 1},
        headers=headers_owner,
    )

    from src.models.Champion import Champion
    from src.models.ChampionUser import ChampionUser

    defender_champ = Champion(name="Thanos", champion_class="Cosmic")
    attacker_champ = Champion(name="Spider-Man", champion_class="Science", is_saga_attacker=True)
    attacker_cu = ChampionUser(
        game_account_id=member.id,
        champion_id=attacker_champ.id,
        stars=7,
        rank=4,
        ascension=0,
    )
    await load_objects([defender_champ, attacker_champ, attacker_cu])

    war = War(
        id=uuid.uuid4(),
        alliance_id=alliance.id,
        opponent_name=OPPONENT,
        created_by_id=owner.id,
    )
    placement = WarDefensePlacement(
        war_id=war.id,
        battlegroup=1,
        node_number=10,
        champion_id=defender_champ.id,
        stars=6,
        rank=3,
        ascension=0,
        attacker_champion_user_id=attacker_cu.id,
        ko_count=1,
        is_combat_completed=False,
    )
    await load_objects([war, placement])

    return {
        "alliance": alliance,
        "owner": owner,
        "member": member,
        "war": war,
        "placement": placement,
        "attacker_cu": attacker_cu,
        "attacker_champ": attacker_champ,
        "defender_champ": defender_champ,
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

        records = (
            await session.exec(
                select(WarFightRecord).where(WarFightRecord.war_id == data["war"].id)
            )
        ).all()
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
            user_id=USER_ID,
            game_pseudo=GAME_PSEUDO,
            alliance_name=ALLIANCE_NAME,
            alliance_tag=ALLIANCE_TAG,
        )
        await push_officer(alliance, owner)
        defender_champ = await push_champion(name="Hulk", champion_class="Science")
        war = War(
            id=uuid.uuid4(),
            alliance_id=alliance.id,
            opponent_name=OPPONENT,
            created_by_id=owner.id,
        )
        placement = WarDefensePlacement(
            war_id=war.id,
            battlegroup=1,
            node_number=5,
            champion_id=defender_champ.id,
            stars=6,
            rank=3,
            ascension=0,
        )
        await load_objects([war, placement])

        headers = create_auth_headers(user_id=str(USER_ID))
        response = await execute_post_request(
            f"/alliances/{alliance.id}/wars/{war.id}/end",
            payload={"win": False, "elo_change": None},
            headers=headers,
        )
        assert response.status_code == 200

        records = (
            await session.exec(select(WarFightRecord).where(WarFightRecord.war_id == war.id))
        ).all()
        assert len(records) == 0

    @pytest.mark.asyncio
    async def test_end_war_idempotent_snapshot(self, session):
        """Calling end_war twice must not create duplicate fight records."""
        data = await _setup_war_with_fight()
        headers = create_auth_headers(user_id=str(USER_ID))

        response1 = await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/end",
            payload={"win": True, "elo_change": 50},
            headers=headers,
        )
        assert response1.status_code == 200

        response2 = await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/end",
            payload={"win": True, "elo_change": 50},
            headers=headers,
        )
        assert response2.status_code == 200

        records = (
            await session.exec(
                select(WarFightRecord).where(WarFightRecord.war_id == data["war"].id)
            )
        ).all()
        assert len(records) == 1

        war = await session.get(War, data["war"].id)
        assert war.snapshotted_at is not None


class TestListFightRecords:
    @pytest.mark.asyncio
    async def test_list_fight_records_returns_snapshot(self):
        data = await _setup_war_with_fight()
        headers_owner = create_auth_headers(user_id=str(USER_ID))

        await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/end",
            payload={"win": True, "elo_change": 50},
            headers=headers_owner,
        )

        response = await execute_get_request("/fight-records", headers=headers_owner)
        assert response.status_code == 200
        body = response.json()
        assert body["total"] == 1
        assert len(body["items"]) == 1
        record = body["items"][0]
        assert record["node_number"] == 10
        assert record["battlegroup"] == 1
        assert record["champion_id"] == str(data["attacker_champ"].id)
        assert record["stars"] == 7
        assert record["rank"] == 4
        assert record["is_saga_attacker"] is True
        assert record["defender_champion_id"] == str(data["defender_champ"].id)
        assert record["ko_count"] == 1
        assert record["alliance_name"] is not None

    @pytest.mark.asyncio
    async def test_list_fight_records_filtered_by_champion(self):
        data = await _setup_war_with_fight()
        headers_owner = create_auth_headers(user_id=str(USER_ID))

        await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/end",
            payload={"win": True, "elo_change": 50},
            headers=headers_owner,
        )

        response = await execute_get_request(
            f"/fight-records?champion_id={data['attacker_champ'].id}",
            headers=headers_owner,
        )
        assert response.status_code == 200
        assert len(response.json()["items"]) == 1

        response_no_match = await execute_get_request(
            f"/fight-records?champion_id={uuid.uuid4()}",
            headers=headers_owner,
        )
        assert response_no_match.status_code == 200
        assert len(response_no_match.json()["items"]) == 0

    @pytest.mark.asyncio
    async def test_list_fight_records_requires_alliance_membership(self):
        """User without a game account (no alliance) must get 403."""
        await load_objects([get_generic_user(is_base_id=True)])
        headers = create_auth_headers(user_id=str(USER_ID))
        response = await execute_get_request("/fight-records", headers=headers)
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_list_fight_records_pagination(self):
        """Three fight records paged by size=2 must return correct total/pages/items."""
        data = await _setup_war_with_fight()
        headers_owner = create_auth_headers(user_id=str(USER_ID))

        # End war 1
        await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/end",
            payload={"win": True, "elo_change": 10},
            headers=headers_owner,
        )

        # War 2
        war2 = War(
            id=uuid.uuid4(),
            alliance_id=data["alliance"].id,
            opponent_name=OPPONENT,
            created_by_id=data["owner"].id,
        )
        placement2 = WarDefensePlacement(
            war_id=war2.id,
            battlegroup=1,
            node_number=10,
            champion_id=data["defender_champ"].id,
            stars=6,
            rank=3,
            ascension=0,
            attacker_champion_user_id=data["attacker_cu"].id,
            ko_count=1,
            is_combat_completed=False,
        )
        await load_objects([war2, placement2])
        await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars/{war2.id}/end",
            payload={"win": True, "elo_change": 10},
            headers=headers_owner,
        )

        # War 3
        war3 = War(
            id=uuid.uuid4(),
            alliance_id=data["alliance"].id,
            opponent_name=OPPONENT,
            created_by_id=data["owner"].id,
        )
        placement3 = WarDefensePlacement(
            war_id=war3.id,
            battlegroup=1,
            node_number=10,
            champion_id=data["defender_champ"].id,
            stars=6,
            rank=3,
            ascension=0,
            attacker_champion_user_id=data["attacker_cu"].id,
            ko_count=1,
            is_combat_completed=False,
        )
        await load_objects([war3, placement3])
        await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars/{war3.id}/end",
            payload={"win": True, "elo_change": 10},
            headers=headers_owner,
        )

        # Page 1: size=2
        resp1 = await execute_get_request("/fight-records?page=1&size=2", headers=headers_owner)
        assert resp1.status_code == 200
        body1 = resp1.json()
        assert body1["total"] == 3
        assert len(body1["items"]) == 2
        assert body1["pages"] == 2

        # Page 2: size=2
        resp2 = await execute_get_request("/fight-records?page=2&size=2", headers=headers_owner)
        assert resp2.status_code == 200
        body2 = resp2.json()
        assert len(body2["items"]) == 1

    @pytest.mark.asyncio
    async def test_list_fight_records_sort_by_ko_count(self):
        """sort_by=ko_count asc/desc must order items correctly."""
        data = await _setup_war_with_fight()
        headers_owner = create_auth_headers(user_id=str(USER_ID))

        # End war 1 (ko_count=1 set in placement by _setup_war_with_fight)
        await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/end",
            payload={"win": True, "elo_change": 10},
            headers=headers_owner,
        )

        # War 2 with ko_count=3
        war2 = War(
            id=uuid.uuid4(),
            alliance_id=data["alliance"].id,
            opponent_name=OPPONENT,
            created_by_id=data["owner"].id,
        )
        placement2 = WarDefensePlacement(
            war_id=war2.id,
            battlegroup=1,
            node_number=10,
            champion_id=data["defender_champ"].id,
            stars=6,
            rank=3,
            ascension=0,
            attacker_champion_user_id=data["attacker_cu"].id,
            ko_count=3,
            is_combat_completed=False,
        )
        await load_objects([war2, placement2])
        await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars/{war2.id}/end",
            payload={"win": True, "elo_change": 10},
            headers=headers_owner,
        )

        # ASC: first item should have lower ko_count
        resp_asc = await execute_get_request(
            "/fight-records?sort_by=ko_count&sort_order=asc",
            headers=headers_owner,
        )
        assert resp_asc.status_code == 200
        items_asc = resp_asc.json()["items"]
        assert len(items_asc) == 2
        assert items_asc[0]["ko_count"] <= items_asc[1]["ko_count"]

        # DESC: first item should have higher ko_count
        resp_desc = await execute_get_request(
            "/fight-records?sort_by=ko_count&sort_order=desc",
            headers=headers_owner,
        )
        assert resp_desc.status_code == 200
        items_desc = resp_desc.json()["items"]
        assert len(items_desc) == 2
        assert items_desc[0]["ko_count"] >= items_desc[1]["ko_count"]


class TestAdminSnapshotEndpoints:
    @pytest.mark.asyncio
    async def test_force_snapshot_snapshots_unsnapshotted_wars(self, session):
        """Ended war with no snapshotted_at must be snapshotted by force-snapshot."""
        data = await _setup_war_with_fight()
        # End the war via the API so it has status=ended but snapshotted_at is set by end_war.
        # Instead, directly set war status to ended without calling snapshot_war.
        from src.models.War import WarStatus

        war = await session.get(War, data["war"].id)
        war.status = WarStatus.ended
        war.tier = 1
        session.add(war)
        await session.commit()

        admin_headers = create_auth_headers(user_id=str(USER_ID), role=Roles.ADMIN)
        response = await execute_post_request(
            "/admin/wars/force-snapshot",
            payload={},
            headers=admin_headers,
        )
        assert response.status_code == 200
        body = response.json()
        assert body["snapshotted"] == 1
        assert body["skipped"] == 0

        await session.refresh(war)
        assert war.snapshotted_at is not None

    @pytest.mark.asyncio
    async def test_force_snapshot_skips_already_snapshotted(self, session):
        """Wars that are already snapshotted must not be re-processed."""
        data = await _setup_war_with_fight()
        # End the war normally (triggers auto-snapshot via end_war endpoint).
        owner_headers = create_auth_headers(user_id=str(USER_ID))
        await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/end",
            payload={"win": True, "elo_change": 50},
            headers=owner_headers,
        )

        admin_headers = create_auth_headers(user_id=str(USER_ID), role=Roles.ADMIN)
        response = await execute_post_request(
            "/admin/wars/force-snapshot",
            payload={},
            headers=admin_headers,
        )
        assert response.status_code == 200
        body = response.json()
        assert body["snapshotted"] == 0
        assert body["skipped"] == 1

    @pytest.mark.asyncio
    async def test_get_snapshot_stats_returns_counts(self, session):
        """After ending a war, snapshot-stats must show alliance with war_count=1."""
        data = await _setup_war_with_fight()
        owner_headers = create_auth_headers(user_id=str(USER_ID))
        await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/end",
            payload={"win": True, "elo_change": 50},
            headers=owner_headers,
        )

        admin_headers = create_auth_headers(user_id=str(USER_ID), role=Roles.ADMIN)
        response = await execute_get_request("/admin/wars/snapshot-stats", headers=admin_headers)
        assert response.status_code == 200
        body = response.json()
        assert len(body) == 1
        stat = body[0]
        assert stat["alliance_id"] == str(data["alliance"].id)
        assert stat["war_count"] == 1

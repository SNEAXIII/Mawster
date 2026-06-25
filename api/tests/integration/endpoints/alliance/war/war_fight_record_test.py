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
    push_visitor,
)
from tests.integration.endpoints.setup.user_setup import get_generic_user, push_user2
from sqlmodel.ext.asyncio.session import AsyncSession
from tests.utils.utils_db import load_objects, sqlite_async_engine
from src.models.Champion import Champion
from src.models.ChampionUser import ChampionUser
from src.models.War import War
from src.models.WarDefensePlacement import WarDefensePlacement
from src.models.WarFightRecord import WarFightRecord
from src.models.WarFightPrefight import WarFightPrefight
from src.models.WarFightSynergy import WarFightSynergy
from src.models.Season import Season
from src.enums.SeasonStatus import SeasonStatus
from src.models.WarPrefightAttacker import WarPrefightAttacker
from src.models.WarSynergyAttacker import WarSynergyAttacker
from sqlmodel import and_, select

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
    async def test_snapshot_links_note_to_fight_record(self, session):
        """A WarFightNote on a snapshotted node must be linked to its WarFightRecord."""
        from src.services.knowledge.FightRecordService import FightRecordService
        from src.services.alliance.war.WarFightNoteService import WarFightNoteService
        from src.dto.alliance.war.dto_war_note import WarFightNoteUpsertRequest
        from src.models.WarFightNote import WarFightNote

        data = await _setup_war_with_fight()

        async with AsyncSession(sqlite_async_engine, expire_on_commit=False) as s:
            war = await s.get(War, data["war"].id)
            war.tier = 1
            s.add(war)
            await s.commit()
            await WarFightNoteService.upsert_note(
                s,
                war=war,
                battlegroup=1,
                node_number=10,
                body=WarFightNoteUpsertRequest(content="frozen note"),
                editor_account_id=data["owner"].id,
                editor_user_id=data["owner"].user_id,
            )
            await FightRecordService.snapshot_war(s, war)

        record = (
            await session.exec(
                select(WarFightRecord).where(
                    and_(
                        WarFightRecord.war_id == data["war"].id,
                        WarFightRecord.node_number == 10,
                    )
                )
            )
        ).first()
        assert record is not None

        note = (
            await session.exec(select(WarFightNote).where(WarFightNote.war_id == data["war"].id))
        ).first()
        assert note is not None
        assert note.war_fight_record_id == record.id

    @pytest.mark.asyncio
    async def test_fight_record_row_includes_note(self, session):
        """A knowledge-base fight-record row must surface the linked note content."""
        from src.services.knowledge.FightRecordService import FightRecordService
        from src.services.alliance.war.WarFightNoteService import WarFightNoteService
        from src.dto.alliance.war.dto_war_note import WarFightNoteUpsertRequest

        data = await _setup_war_with_fight()

        async with AsyncSession(sqlite_async_engine, expire_on_commit=False) as s:
            war = await s.get(War, data["war"].id)
            war.tier = 1
            s.add(war)
            await s.commit()
            await WarFightNoteService.upsert_note(
                s,
                war=war,
                battlegroup=1,
                node_number=10,
                body=WarFightNoteUpsertRequest(content="frozen note"),
                editor_account_id=data["owner"].id,
                editor_user_id=data["owner"].user_id,
            )
            await FightRecordService.snapshot_war(s, war)

        result = await FightRecordService.get_fight_records(
            session,
            accessible_alliance_ids=[data["war"].alliance_id],
        )
        row = next(item for item in result.items if item.node_number == 10)
        assert row.note == "frozen note"
        assert row.note_author == data["owner"].game_pseudo

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
    async def test_list_fight_records_filtered_by_game_account_pseudo(self):
        data = await _setup_war_with_fight()
        headers_owner = create_auth_headers(user_id=str(USER_ID))

        await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/end",
            payload={"win": True, "elo_change": 50},
            headers=headers_owner,
        )

        # Exact match
        resp = await execute_get_request(
            f"/fight-records?game_account_pseudo={GAME_PSEUDO_2}",
            headers=headers_owner,
        )
        assert resp.status_code == 200
        assert len(resp.json()["items"]) == 1
        assert resp.json()["items"][0]["game_account_pseudo"] == GAME_PSEUDO_2

        # Case-insensitive partial match
        resp_partial = await execute_get_request(
            "/fight-records?game_account_pseudo=testplayer",
            headers=headers_owner,
        )
        assert resp_partial.status_code == 200
        assert len(resp_partial.json()["items"]) == 1

        # No match
        resp_no_match = await execute_get_request(
            "/fight-records?game_account_pseudo=unknownplayer",
            headers=headers_owner,
        )
        assert resp_no_match.status_code == 200
        assert len(resp_no_match.json()["items"]) == 0

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

    @pytest.mark.asyncio
    async def test_filter_by_defender_champion_id(self):
        """defender_champion_id filter must return only matching records (line 178)."""
        data = await _setup_war_with_fight()
        headers = create_auth_headers(user_id=str(USER_ID))

        await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/end",
            payload={"win": True, "elo_change": 10},
            headers=headers,
        )

        resp = await execute_get_request(
            f"/fight-records?defender_champion_id={data['defender_champ'].id}",
            headers=headers,
        )
        assert resp.status_code == 200
        assert len(resp.json()["items"]) == 1

        resp_no_match = await execute_get_request(
            f"/fight-records?defender_champion_id={uuid.uuid4()}",
            headers=headers,
        )
        assert resp_no_match.status_code == 200
        assert len(resp_no_match.json()["items"]) == 0

    @pytest.mark.asyncio
    async def test_filter_by_node_number(self):
        """node_number filter must return only records on that node (line 180)."""
        data = await _setup_war_with_fight()
        headers = create_auth_headers(user_id=str(USER_ID))

        await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/end",
            payload={"win": True, "elo_change": 10},
            headers=headers,
        )

        resp = await execute_get_request("/fight-records?node_number=10", headers=headers)
        assert resp.status_code == 200
        assert len(resp.json()["items"]) == 1

        resp_no_match = await execute_get_request("/fight-records?node_number=49", headers=headers)
        assert resp_no_match.status_code == 200
        assert len(resp_no_match.json()["items"]) == 0

    @pytest.mark.asyncio
    async def test_filter_by_tier(self):
        """tier filter must return only records with matching tier (line 182)."""
        data = await _setup_war_with_fight()
        headers = create_auth_headers(user_id=str(USER_ID))

        record = WarFightRecord(
            war_id=data["war"].id,
            alliance_id=data["alliance"].id,
            game_account_id=data["member"].id,
            battlegroup=1,
            node_number=10,
            tier=5,
            champion_id=data["attacker_champ"].id,
            stars=7,
            rank=4,
            ascension=0,
            is_saga_attacker=True,
            defender_champion_id=data["defender_champ"].id,
            defender_stars=6,
            defender_rank=3,
            defender_ascension=0,
            defender_is_saga_defender=False,
        )
        await load_objects([record])

        resp = await execute_get_request("/fight-records?tier=5", headers=headers)
        assert resp.status_code == 200
        assert len(resp.json()["items"]) == 1

        resp_no_match = await execute_get_request("/fight-records?tier=99", headers=headers)
        assert resp_no_match.status_code == 200
        assert len(resp_no_match.json()["items"]) == 0

    @pytest.mark.asyncio
    async def test_filter_by_season_selector_specific(self):
        """season_selector=specific with season_id must return only records with matching season."""
        data = await _setup_war_with_fight()
        headers = create_auth_headers(user_id=str(USER_ID))

        season = Season(number=64, status=SeasonStatus.ended)
        await load_objects([season])

        async with AsyncSession(sqlite_async_engine, expire_on_commit=False) as session:
            war = await session.get(War, data["war"].id)
            war.season_id = season.id
            session.add(war)
            await session.commit()

        await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/end",
            payload={"win": True, "elo_change": 10},
            headers=headers,
        )

        resp = await execute_get_request(
            f"/fight-records?season_selector=specific&season_id={season.id}", headers=headers
        )
        assert resp.status_code == 200
        assert len(resp.json()["items"]) == 1

        resp_no_match = await execute_get_request(
            f"/fight-records?season_selector=specific&season_id={uuid.uuid4()}", headers=headers
        )
        assert resp_no_match.status_code == 200
        assert len(resp_no_match.json()["items"]) == 0

    @pytest.mark.asyncio
    async def test_filter_by_alliance_id(self):
        """alliance_id filter must return only records for that alliance (line 186)."""
        data = await _setup_war_with_fight()
        headers = create_auth_headers(user_id=str(USER_ID))

        await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/end",
            payload={"win": True, "elo_change": 10},
            headers=headers,
        )

        resp = await execute_get_request(
            f"/fight-records?alliance_id={data['alliance'].id}", headers=headers
        )
        assert resp.status_code == 200
        assert len(resp.json()["items"]) == 1

        resp_no_match = await execute_get_request(
            f"/fight-records?alliance_id={uuid.uuid4()}", headers=headers
        )
        assert resp_no_match.status_code == 200
        assert len(resp_no_match.json()["items"]) == 0

    @pytest.mark.asyncio
    async def test_filter_by_battlegroup(self):
        """battlegroup filter must return only records in that battlegroup (line 188)."""
        data = await _setup_war_with_fight()
        headers = create_auth_headers(user_id=str(USER_ID))

        await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/end",
            payload={"win": True, "elo_change": 10},
            headers=headers,
        )

        resp = await execute_get_request("/fight-records?battlegroup=1", headers=headers)
        assert resp.status_code == 200
        assert len(resp.json()["items"]) == 1

        resp_no_match = await execute_get_request("/fight-records?battlegroup=3", headers=headers)
        assert resp_no_match.status_code == 200
        assert len(resp_no_match.json()["items"]) == 0

    @pytest.mark.asyncio
    async def test_filter_by_planning_error(self):
        """planning_error_only filter must return only matching records (line 192)."""
        data = await _setup_war_with_fight()
        headers = create_auth_headers(user_id=str(USER_ID))

        # Mark the placement as a planning error before snapshot
        async with AsyncSession(sqlite_async_engine, expire_on_commit=False) as session:
            placement = await session.get(WarDefensePlacement, data["placement"].id)
            placement.is_planning_error = True
            session.add(placement)
            await session.commit()

        await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/end",
            payload={"win": True, "elo_change": 10},
            headers=headers,
        )

        resp_true = await execute_get_request(
            "/fight-records?planning_error_only=true", headers=headers
        )
        assert resp_true.status_code == 200
        assert len(resp_true.json()["items"]) == 1

        resp_false = await execute_get_request(
            "/fight-records?planning_error_only=false", headers=headers
        )
        assert resp_false.status_code == 200
        assert len(resp_false.json()["items"]) == 0

    @pytest.mark.asyncio
    async def test_sort_by_champion_name(self):
        """sort_by=champion_name must join AttackerChampion and order by name (lines 236-237)."""
        data = await _setup_war_with_fight()
        headers = create_auth_headers(user_id=str(USER_ID))

        await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/end",
            payload={"win": True, "elo_change": 10},
            headers=headers,
        )

        resp = await execute_get_request(
            "/fight-records?sort_by=champion_name&sort_order=asc", headers=headers
        )
        assert resp.status_code == 200
        assert len(resp.json()["items"]) == 1
        assert resp.json()["items"][0]["champion_name"] == "Spider-Man"

    @pytest.mark.asyncio
    async def test_sort_by_defender_champion_name(self):
        """sort_by=defender_champion_name must join DefenderChampion and order by name (lines 239-242)."""
        data = await _setup_war_with_fight()
        headers = create_auth_headers(user_id=str(USER_ID))

        await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/end",
            payload={"win": True, "elo_change": 10},
            headers=headers,
        )

        resp = await execute_get_request(
            "/fight-records?sort_by=defender_champion_name&sort_order=desc", headers=headers
        )
        assert resp.status_code == 200
        assert len(resp.json()["items"]) == 1
        assert resp.json()["items"][0]["defender_champion_name"] == "Thanos"

    @pytest.mark.asyncio
    async def test_filter_by_season_selector_all_seasons(self):
        """season_selector=all_seasons must exclude off-season records (season_id IS NULL)."""
        data = await _setup_war_with_fight()
        headers = create_auth_headers(user_id=str(USER_ID))

        season = Season(number=65, status=SeasonStatus.ended)
        await load_objects([season])

        # Record with season
        record_with_season = WarFightRecord(
            war_id=data["war"].id,
            alliance_id=data["alliance"].id,
            game_account_id=data["member"].id,
            battlegroup=1,
            node_number=10,
            tier=1,
            season_id=season.id,
            champion_id=data["attacker_champ"].id,
            stars=7,
            rank=4,
            ascension=0,
            is_saga_attacker=True,
            defender_champion_id=data["defender_champ"].id,
            defender_stars=6,
            defender_rank=3,
            defender_ascension=0,
            defender_is_saga_defender=False,
        )
        # Record without season (off-season)
        record_off_season = WarFightRecord(
            war_id=data["war"].id,
            alliance_id=data["alliance"].id,
            game_account_id=data["member"].id,
            battlegroup=1,
            node_number=11,
            tier=1,
            season_id=None,
            champion_id=data["attacker_champ"].id,
            stars=7,
            rank=4,
            ascension=0,
            is_saga_attacker=True,
            defender_champion_id=data["defender_champ"].id,
            defender_stars=6,
            defender_rank=3,
            defender_ascension=0,
            defender_is_saga_defender=False,
        )
        await load_objects([record_with_season, record_off_season])

        resp = await execute_get_request(
            "/fight-records?season_selector=all_seasons", headers=headers
        )
        assert resp.status_code == 200
        assert resp.json()["total"] == 1
        assert resp.json()["items"][0]["node_number"] == 10

    @pytest.mark.asyncio
    async def test_filter_by_season_selector_off_season(self):
        """season_selector=off_season must return only records where season_id IS NULL."""
        data = await _setup_war_with_fight()
        headers = create_auth_headers(user_id=str(USER_ID))

        season = Season(number=66, status=SeasonStatus.ended)
        await load_objects([season])

        record_with_season = WarFightRecord(
            war_id=data["war"].id,
            alliance_id=data["alliance"].id,
            game_account_id=data["member"].id,
            battlegroup=1,
            node_number=10,
            tier=1,
            season_id=season.id,
            champion_id=data["attacker_champ"].id,
            stars=7,
            rank=4,
            ascension=0,
            is_saga_attacker=True,
            defender_champion_id=data["defender_champ"].id,
            defender_stars=6,
            defender_rank=3,
            defender_ascension=0,
            defender_is_saga_defender=False,
        )
        record_off_season = WarFightRecord(
            war_id=data["war"].id,
            alliance_id=data["alliance"].id,
            game_account_id=data["member"].id,
            battlegroup=1,
            node_number=11,
            tier=1,
            season_id=None,
            champion_id=data["attacker_champ"].id,
            stars=7,
            rank=4,
            ascension=0,
            is_saga_attacker=True,
            defender_champion_id=data["defender_champ"].id,
            defender_stars=6,
            defender_rank=3,
            defender_ascension=0,
            defender_is_saga_defender=False,
        )
        await load_objects([record_with_season, record_off_season])

        resp = await execute_get_request(
            "/fight-records?season_selector=off_season", headers=headers
        )
        assert resp.status_code == 200
        assert resp.json()["total"] == 1
        assert resp.json()["items"][0]["node_number"] == 11

    @pytest.mark.asyncio
    async def test_filter_by_season_selector_current(self):
        """season_selector=current must return only records linked to the active season."""
        data = await _setup_war_with_fight()
        headers = create_auth_headers(user_id=str(USER_ID))

        active_season = Season(number=67, status=SeasonStatus.active)
        old_season = Season(number=66, status=SeasonStatus.ended)
        await load_objects([active_season, old_season])

        record_current = WarFightRecord(
            war_id=data["war"].id,
            alliance_id=data["alliance"].id,
            game_account_id=data["member"].id,
            battlegroup=1,
            node_number=10,
            tier=1,
            season_id=active_season.id,
            champion_id=data["attacker_champ"].id,
            stars=7,
            rank=4,
            ascension=0,
            is_saga_attacker=True,
            defender_champion_id=data["defender_champ"].id,
            defender_stars=6,
            defender_rank=3,
            defender_ascension=0,
            defender_is_saga_defender=False,
        )
        record_old = WarFightRecord(
            war_id=data["war"].id,
            alliance_id=data["alliance"].id,
            game_account_id=data["member"].id,
            battlegroup=1,
            node_number=11,
            tier=1,
            season_id=old_season.id,
            champion_id=data["attacker_champ"].id,
            stars=7,
            rank=4,
            ascension=0,
            is_saga_attacker=True,
            defender_champion_id=data["defender_champ"].id,
            defender_stars=6,
            defender_rank=3,
            defender_ascension=0,
            defender_is_saga_defender=False,
        )
        await load_objects([record_current, record_old])

        resp = await execute_get_request("/fight-records?season_selector=current", headers=headers)
        assert resp.status_code == 200
        assert resp.json()["total"] == 1
        assert resp.json()["items"][0]["node_number"] == 10

    @pytest.mark.asyncio
    async def test_filter_by_season_selector_specific_without_id_returns_all(self):
        """season_selector=specific without season_id must apply no filter."""
        data = await _setup_war_with_fight()
        headers = create_auth_headers(user_id=str(USER_ID))

        season = Season(number=68, status=SeasonStatus.ended)
        await load_objects([season])

        record1 = WarFightRecord(
            war_id=data["war"].id,
            alliance_id=data["alliance"].id,
            game_account_id=data["member"].id,
            battlegroup=1,
            node_number=10,
            tier=1,
            season_id=season.id,
            champion_id=data["attacker_champ"].id,
            stars=7,
            rank=4,
            ascension=0,
            is_saga_attacker=True,
            defender_champion_id=data["defender_champ"].id,
            defender_stars=6,
            defender_rank=3,
            defender_ascension=0,
            defender_is_saga_defender=False,
        )
        record2 = WarFightRecord(
            war_id=data["war"].id,
            alliance_id=data["alliance"].id,
            game_account_id=data["member"].id,
            battlegroup=1,
            node_number=11,
            tier=1,
            season_id=None,
            champion_id=data["attacker_champ"].id,
            stars=7,
            rank=4,
            ascension=0,
            is_saga_attacker=True,
            defender_champion_id=data["defender_champ"].id,
            defender_stars=6,
            defender_rank=3,
            defender_ascension=0,
            defender_is_saga_defender=False,
        )
        await load_objects([record1, record2])

        resp = await execute_get_request("/fight-records?season_selector=specific", headers=headers)
        assert resp.status_code == 200
        assert resp.json()["total"] == 2

    @pytest.mark.asyncio
    async def test_sort_by_alliance_name(self):
        """sort_by=alliance_name must join Alliance and order by name (lines 244-245)."""
        data = await _setup_war_with_fight()
        headers = create_auth_headers(user_id=str(USER_ID))

        await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/end",
            payload={"win": True, "elo_change": 10},
            headers=headers,
        )

        resp = await execute_get_request(
            "/fight-records?sort_by=alliance_name&sort_order=asc", headers=headers
        )
        assert resp.status_code == 200
        assert len(resp.json()["items"]) == 1
        assert resp.json()["items"][0]["alliance_name"] == ALLIANCE_NAME


class TestSnapshotWithPrefightsAndSynergies:
    @pytest.mark.asyncio
    async def test_snapshot_records_prefight_attackers(self, session):
        """WarPrefightAttacker rows linked to the placement must be snapshotted as WarFightPrefight (lines 96-97)."""
        data = await _setup_war_with_fight()
        headers = create_auth_headers(user_id=str(USER_ID))

        # Add a prefight attacker for node 10 BG1
        prefight_cu_champ = Champion(name="Iron Man", champion_class="Tech")
        prefight_cu = ChampionUser(
            game_account_id=data["member"].id,
            champion_id=prefight_cu_champ.id,
            stars=6,
            rank=3,
            ascension=0,
        )
        await load_objects([prefight_cu_champ, prefight_cu])

        prefight = WarPrefightAttacker(
            war_id=data["war"].id,
            battlegroup=1,
            game_account_id=data["member"].id,
            champion_user_id=prefight_cu.id,
            target_node_number=10,
        )
        await load_objects([prefight])

        await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/end",
            payload={"win": True, "elo_change": 10},
            headers=headers,
        )

        records = (
            await session.exec(
                select(WarFightRecord).where(WarFightRecord.war_id == data["war"].id)
            )
        ).all()
        assert len(records) == 1

        prefights = (
            await session.exec(
                select(WarFightPrefight).where(
                    WarFightPrefight.war_fight_record_id == records[0].id
                )
            )
        ).all()
        assert len(prefights) == 1
        assert prefights[0].champion_id == prefight_cu_champ.id

    @pytest.mark.asyncio
    async def test_snapshot_records_synergy_attackers(self, session):
        """WarSynergyAttacker rows linked to the attacker must be snapshotted as WarFightSynergy (lines 120-121)."""
        data = await _setup_war_with_fight()
        headers = create_auth_headers(user_id=str(USER_ID))

        # Add a synergy attacker targeting the main attacker_cu
        synergy_cu_champ = Champion(name="Thor", champion_class="Cosmic")
        synergy_cu = ChampionUser(
            game_account_id=data["member"].id,
            champion_id=synergy_cu_champ.id,
            stars=6,
            rank=3,
            ascension=0,
        )
        await load_objects([synergy_cu_champ, synergy_cu])

        synergy = WarSynergyAttacker(
            war_id=data["war"].id,
            battlegroup=1,
            game_account_id=data["member"].id,
            champion_user_id=synergy_cu.id,
            target_champion_user_id=data["attacker_cu"].id,
        )
        await load_objects([synergy])

        await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/end",
            payload={"win": True, "elo_change": 10},
            headers=headers,
        )

        records = (
            await session.exec(
                select(WarFightRecord).where(WarFightRecord.war_id == data["war"].id)
            )
        ).all()
        assert len(records) == 1

        synergies = (
            await session.exec(
                select(WarFightSynergy).where(WarFightSynergy.war_fight_record_id == records[0].id)
            )
        ).all()
        assert len(synergies) == 1
        assert synergies[0].champion_id == synergy_cu_champ.id


class TestFightRecordScoping:
    @pytest.mark.asyncio
    async def test_get_fight_records_member_sees_own_alliance(self):
        """Member sees records from their own alliance only."""
        data = await _setup_war_with_fight()
        headers_owner = create_auth_headers(user_id=str(USER_ID))

        await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/end",
            payload={"win": True, "elo_change": 50},
            headers=headers_owner,
        )

        resp = await execute_get_request("/fight-records", headers=headers_owner)
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] > 0
        for item in body["items"]:
            assert item["alliance_id"] == str(data["alliance"].id)

    @pytest.mark.asyncio
    async def test_get_fight_records_no_alliance_returns_403(self):
        """User with no alliance or visitor link gets 403."""
        await load_objects([get_generic_user(is_base_id=True)])
        headers = create_auth_headers(user_id=str(USER_ID))

        resp = await execute_get_request("/fight-records", headers=headers)
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_get_fight_records_visitor_sees_visited_alliance(self):
        """Visitor of alliance A can see fight records from alliance A."""
        data = await _setup_war_with_fight()
        headers_owner = create_auth_headers(user_id=str(USER_ID))

        await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/end",
            payload={"win": True, "elo_change": 50},
            headers=headers_owner,
        )

        visitor_user_id = uuid.uuid4()
        from src.models import User
        from src.utils.email_hash import hash_email

        visitor_user = User(
            id=visitor_user_id,
            login="visitor_fight_record",
            email_hash=hash_email("visitor_fight_record@test.com"),
            discord_id="discord_visitor_fight_record",
        )
        await load_objects([visitor_user])

        await push_visitor(data["alliance"], user_id=visitor_user_id, game_pseudo="VisitorPlayer")

        visitor_headers = create_auth_headers(user_id=str(visitor_user_id))
        resp = await execute_get_request("/fight-records", headers=visitor_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] > 0
        for item in body["items"]:
            assert item["alliance_id"] == str(data["alliance"].id)

    @pytest.mark.asyncio
    async def test_get_fight_records_non_accessible_alliance_id_returns_empty(self):
        """alliance_id filter for an inaccessible alliance returns 200 + empty list."""
        data = await _setup_war_with_fight()
        headers_owner = create_auth_headers(user_id=str(USER_ID))

        await execute_post_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/end",
            payload={"win": True, "elo_change": 50},
            headers=headers_owner,
        )

        other_id = uuid.uuid4()
        resp = await execute_get_request(
            f"/fight-records?alliance_id={other_id}", headers=headers_owner
        )
        assert resp.status_code == 200
        assert resp.json()["total"] == 0


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

"""Integration tests for war fight record snapshot and knowledge base."""

import uuid

import pytest
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.dto.alliance.war.dto_war_note import WarFightNoteUpsertRequest
from src.enums.Roles import Roles
from src.enums.SeasonStatus import SeasonStatus
from src.enums.WarBoost import WarBoost
from src.enums.WarStatus import WarStatus
from src.models import User
from src.models.champion.Champion import Champion
from src.models.champion.ChampionUser import ChampionUser
from src.models.war.Season import Season
from src.models.war.War import War
from src.models.war.WarDefensePlacement import WarDefensePlacement
from src.models.war.WarFightNote import WarFightNote
from src.models.war.WarFightRecord import WarFightRecord
from src.models.war.WarPrefightAttacker import WarPrefightAttacker
from src.models.war.WarSynergyAttacker import WarSynergyAttacker
from src.services.admin.SagaService import SagaService
from src.services.alliance.war.WarFightNoteService import WarFightNoteService
from src.services.knowledge.FightRecordService import FightRecordService
from src.utils.email_hash import hash_email
from tests.integration.endpoints.setup.fight_record_setup import push_ended_war, push_fight_record
from tests.integration.endpoints.setup.game_setup import (
    push_alliance_with_owner,
    push_champion,
    push_member,
    push_officer,
    push_visitor,
)
from tests.integration.endpoints.setup.user_setup import get_generic_user, push_user2
from tests.utils.utils_client import (
    create_auth_headers,
    execute_get_request,
    execute_patch_request,
    execute_post_request,
    execute_put_request,
)
from tests.utils.utils_constant import (
    ALLIANCE_NAME,
    ALLIANCE_TAG,
    GAME_PSEUDO,
    GAME_PSEUDO_2,
    USER2_ID,
    USER_ID,
)
from tests.utils.utils_db import load_objects, sqlite_async_engine

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
    attacker_champ = Champion(name="Spider-Man", champion_class="Science")
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


async def _end_war(alliance_id, war_id, *, headers, win=True, elo_change=50, expected_status=200):
    """POST the end-war route, which is what triggers the fight-record snapshot."""
    response = await execute_post_request(
        f"/alliances/{alliance_id}/wars/{war_id}/end",
        payload={"win": win, "elo_change": elo_change},
        headers=headers,
    )
    assert response.status_code == expected_status
    return response


async def _fetch_records(session, war_id):
    """Every WarFightRecord snapshotted for one war."""
    return (
        await session.exec(
            select(WarFightRecord)
            .join(
                WarDefensePlacement,
                WarFightRecord.war_defense_placement_id == WarDefensePlacement.id,
            )
            .where(WarDefensePlacement.war_id == war_id)
        )
    ).all()


async def _fetch_single_record(session, war_id):
    """The one record a war is expected to have snapshotted."""
    records = await _fetch_records(session, war_id)
    assert len(records) == 1
    return records[0]


async def _snapshot_war_with_note(data, *, content="frozen note", battlegroup=1, node_number=10):
    """Attach a note to a node, then snapshot the war from its own session.

    The snapshot must run in a separate session so the note is already committed,
    which is what links WarFightNote to the WarFightRecord.
    """
    async with AsyncSession(sqlite_async_engine, expire_on_commit=False) as s:
        war = await s.get(War, data["war"].id)
        war.tier = 1
        s.add(war)
        await s.commit()
        await WarFightNoteService.upsert_note(
            s,
            war=war,
            battlegroup=battlegroup,
            node_number=node_number,
            body=WarFightNoteUpsertRequest(content=content),
            editor_account_id=data["owner"].id,
            editor_user_id=data["owner"].user_id,
        )
        await FightRecordService.snapshot_war(s, war)


async def _push_extra_ended_war(data, *, headers, ko_count=1, node_number=10, elo_change=10):
    """One more war on the same alliance, ended so it snapshots an extra fight record."""
    war = War(
        id=uuid.uuid4(),
        alliance_id=data["alliance"].id,
        opponent_name=OPPONENT,
        created_by_id=data["owner"].id,
    )
    placement = WarDefensePlacement(
        war_id=war.id,
        battlegroup=1,
        node_number=node_number,
        champion_id=data["defender_champ"].id,
        stars=6,
        rank=3,
        ascension=0,
        attacker_champion_user_id=data["attacker_cu"].id,
        ko_count=ko_count,
        is_combat_completed=False,
    )
    await load_objects([war, placement])
    await _end_war(data["alliance"].id, war.id, headers=headers, elo_change=elo_change)
    return war


async def _push_fights_in_two_wars(data, first_season_id, second_season_id):
    """Node 10 fought in a war of the first season, node 11 in a war of the second."""
    for season_id, node_number in ((first_season_id, 10), (second_season_id, 11)):
        war = await push_ended_war(data["alliance"].id, data["owner"].id, season_id=season_id)
        await push_fight_record(
            war, data["attacker_cu"], data["defender_champ"], node_number=node_number
        )


class TestWarFightRecordSnapshot:
    @pytest.mark.asyncio
    async def test_end_war_links_record_to_its_placement(self, session):
        data = await _setup_war_with_fight()
        headers = create_auth_headers(user_id=str(USER_ID))

        await _end_war(data["alliance"].id, data["war"].id, headers=headers)

        r = await _fetch_single_record(session, data["war"].id)
        assert r.war_defense_placement_id == data["placement"].id
        assert r.rank == 4
        assert r.ascension == 0

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
        await _end_war(alliance.id, war.id, headers=headers, win=False, elo_change=None)

        records = await _fetch_records(session, war.id)
        assert len(records) == 0

    @pytest.mark.asyncio
    async def test_snapshot_links_note_to_fight_record(self, session):
        """A WarFightNote on a snapshotted node must be linked to its WarFightRecord."""

        data = await _setup_war_with_fight()

        await _snapshot_war_with_note(data)

        record = await _fetch_single_record(session, data["war"].id)

        note = (
            await session.exec(select(WarFightNote).where(WarFightNote.war_id == data["war"].id))
        ).first()
        assert note is not None
        assert note.war_fight_record_id == record.id

    @pytest.mark.asyncio
    async def test_fight_record_row_includes_note(self, session):
        """A knowledge-base fight-record row must surface the linked note content."""

        data = await _setup_war_with_fight()

        await _snapshot_war_with_note(data)

        result = await FightRecordService.get_fight_records(
            session,
            accessible_alliance_ids=[data["war"].alliance_id],
        )
        row = next(item for item in result.items if item.node_number == 10)
        assert row.note == "frozen note"
        assert row.note_author == data["owner"].game_pseudo

    @pytest.mark.asyncio
    async def test_end_war_twice_does_not_duplicate_snapshot(self, session):
        """Ending an already-ended war is refused, so it cannot re-snapshot fight records."""
        data = await _setup_war_with_fight()
        headers = create_auth_headers(user_id=str(USER_ID))

        await _end_war(data["alliance"].id, data["war"].id, headers=headers)

        await _end_war(data["alliance"].id, data["war"].id, headers=headers, expected_status=409)

        records = await _fetch_records(session, data["war"].id)
        assert len(records) == 1

        war = await session.get(War, data["war"].id)
        assert war.snapshotted_at is not None


class TestListFightRecords:
    @pytest.mark.asyncio
    async def test_list_fight_records_exposes_boosts(self):
        """The knowledge base reads its boosts from this listing, not from the war."""
        data = await _setup_war_with_fight()
        headers_owner = create_auth_headers(user_id=str(USER_ID))

        await execute_put_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/1/node/10/boosts",
            payload={"war_boost": WarBoost.INVULNERABILITY, "has_defense_boost": True},
            headers=headers_owner,
        )
        await _end_war(data["alliance"].id, data["war"].id, headers=headers_owner)

        response = await execute_get_request("/fight-records", headers=headers_owner)
        assert response.status_code == 200
        record = response.json()["items"][0]
        assert record["war_boost"] == WarBoost.INVULNERABILITY
        assert record["has_defense_boost"] is True
        assert record["has_power_boost"] is False

    @pytest.mark.asyncio
    async def test_list_fight_records_returns_snapshot(self):
        data = await _setup_war_with_fight()
        headers_owner = create_auth_headers(user_id=str(USER_ID))

        await _end_war(data["alliance"].id, data["war"].id, headers=headers_owner)

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
        assert record["is_saga_attacker"] is False
        assert record["defender_champion_id"] == str(data["defender_champ"].id)
        assert record["ko_count"] == 1
        assert record["alliance_name"] is not None

    @pytest.mark.asyncio
    async def test_list_fight_records_filtered_by_champion(self):
        data = await _setup_war_with_fight()
        headers_owner = create_auth_headers(user_id=str(USER_ID))

        await _end_war(data["alliance"].id, data["war"].id, headers=headers_owner)

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
        await _end_war(data["alliance"].id, data["war"].id, headers=headers_owner, elo_change=10)

        # War 2
        await _push_extra_ended_war(data, headers=headers_owner)

        # War 3
        await _push_extra_ended_war(data, headers=headers_owner)

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

        await _end_war(data["alliance"].id, data["war"].id, headers=headers_owner)

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
        await _end_war(data["alliance"].id, data["war"].id, headers=headers_owner, elo_change=10)

        # War 2 with ko_count=3
        await _push_extra_ended_war(data, headers=headers_owner, ko_count=3)

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

        await _end_war(data["alliance"].id, data["war"].id, headers=headers, elo_change=10)

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

        await _end_war(data["alliance"].id, data["war"].id, headers=headers, elo_change=10)

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

        war = await push_ended_war(data["alliance"].id, data["owner"].id, tier=5)
        await push_fight_record(war, data["attacker_cu"], data["defender_champ"])

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

        await _end_war(data["alliance"].id, data["war"].id, headers=headers, elo_change=10)

        resp = await execute_get_request(
            f"/fight-records?season_selector=specific&season_id={season.id}", headers=headers
        )
        assert resp.status_code == 200
        assert len(resp.json()["items"]) == 1
        assert resp.json()["items"][0]["season_number"] == 64

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

        await _end_war(data["alliance"].id, data["war"].id, headers=headers, elo_change=10)

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

        await _end_war(data["alliance"].id, data["war"].id, headers=headers, elo_change=10)

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

        await _end_war(data["alliance"].id, data["war"].id, headers=headers, elo_change=10)

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

        await _end_war(data["alliance"].id, data["war"].id, headers=headers, elo_change=10)

        resp = await execute_get_request(
            "/fight-records?sort_by=champion_name&sort_order=asc", headers=headers
        )
        assert resp.status_code == 200
        assert len(resp.json()["items"]) == 1
        assert resp.json()["items"][0]["champion_name"] == "Spider-Man"

    @pytest.mark.asyncio
    async def test_sort_by_season_number(self):
        """sort_by=season_number must order items by the season number of each record."""
        data = await _setup_war_with_fight()
        headers = create_auth_headers(user_id=str(USER_ID))

        older_season = Season(number=70, status=SeasonStatus.ended)
        newer_season = Season(number=71, status=SeasonStatus.ended)
        await load_objects([older_season, newer_season])

        await _push_fights_in_two_wars(data, older_season.id, newer_season.id)

        resp = await execute_get_request(
            "/fight-records?sort_by=season_number&sort_order=asc", headers=headers
        )
        assert resp.status_code == 200
        assert [item["season_number"] for item in resp.json()["items"]] == [70, 71]

        resp_desc = await execute_get_request(
            "/fight-records?sort_by=season_number&sort_order=desc", headers=headers
        )
        assert resp_desc.status_code == 200
        assert [item["season_number"] for item in resp_desc.json()["items"]] == [71, 70]

    @pytest.mark.asyncio
    async def test_sort_by_defender_champion_name(self):
        """sort_by=defender_champion_name must join DefenderChampion and order by name (lines 239-242)."""
        data = await _setup_war_with_fight()
        headers = create_auth_headers(user_id=str(USER_ID))

        await _end_war(data["alliance"].id, data["war"].id, headers=headers, elo_change=10)

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

        await _push_fights_in_two_wars(data, season.id, None)

        resp = await execute_get_request(
            "/fight-records?season_selector=all_seasons", headers=headers
        )
        assert resp.status_code == 200
        assert resp.json()["total"] == 1
        assert resp.json()["items"][0]["node_number"] == 10
        assert resp.json()["items"][0]["season_number"] == 65

    @pytest.mark.asyncio
    async def test_filter_by_season_selector_off_season(self):
        """season_selector=off_season must return only records where season_id IS NULL."""
        data = await _setup_war_with_fight()
        headers = create_auth_headers(user_id=str(USER_ID))

        season = Season(number=66, status=SeasonStatus.ended)
        await load_objects([season])

        await _push_fights_in_two_wars(data, season.id, None)

        resp = await execute_get_request(
            "/fight-records?season_selector=off_season", headers=headers
        )
        assert resp.status_code == 200
        assert resp.json()["total"] == 1
        assert resp.json()["items"][0]["node_number"] == 11
        assert resp.json()["items"][0]["season_number"] is None

    @pytest.mark.asyncio
    async def test_filter_by_season_selector_current(self):
        """season_selector=current must return only records linked to the active season."""
        data = await _setup_war_with_fight()
        headers = create_auth_headers(user_id=str(USER_ID))

        active_season = Season(number=67, status=SeasonStatus.active)
        old_season = Season(number=66, status=SeasonStatus.ended)
        await load_objects([active_season, old_season])

        await _push_fights_in_two_wars(data, active_season.id, old_season.id)

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

        await _push_fights_in_two_wars(data, season.id, None)

        resp = await execute_get_request("/fight-records?season_selector=specific", headers=headers)
        assert resp.status_code == 200
        assert resp.json()["total"] == 2

    @pytest.mark.asyncio
    async def test_sort_by_alliance_name(self):
        """sort_by=alliance_name must join Alliance and order by name (lines 244-245)."""
        data = await _setup_war_with_fight()
        headers = create_auth_headers(user_id=str(USER_ID))

        await _end_war(data["alliance"].id, data["war"].id, headers=headers, elo_change=10)

        resp = await execute_get_request(
            "/fight-records?sort_by=alliance_name&sort_order=asc", headers=headers
        )
        assert resp.status_code == 200
        assert len(resp.json()["items"]) == 1
        assert resp.json()["items"][0]["alliance_name"] == ALLIANCE_NAME


class TestFightRecordReadsTheWar:
    @pytest.mark.asyncio
    async def test_boost_corrected_after_snapshot_shows_in_listing(self):
        data = await _setup_war_with_fight()
        headers = create_auth_headers(user_id=str(USER_ID))
        await _end_war(data["alliance"].id, data["war"].id, headers=headers)

        await execute_put_request(
            f"/alliances/{data['alliance'].id}/wars/{data['war'].id}/bg/1/node/10/boosts",
            payload={"war_boost": "power_start"},
            headers=headers,
        )

        record = (await execute_get_request("/fight-records", headers=headers)).json()["items"][0]
        assert record["war_boost"] == WarBoost.POWER_START

    @pytest.mark.asyncio
    async def test_rank_up_after_snapshot_keeps_frozen_rank(self, session):
        data = await _setup_war_with_fight()
        headers = create_auth_headers(user_id=str(USER_ID))
        await _end_war(data["alliance"].id, data["war"].id, headers=headers)

        cu = await session.get(ChampionUser, data["attacker_cu"].id)
        cu.rank = 5
        cu.ascension = 1
        session.add(cu)
        await session.commit()

        record = (await execute_get_request("/fight-records", headers=headers)).json()["items"][0]
        assert record["rank"] == 4
        assert record["ascension"] == 0

    @pytest.mark.asyncio
    async def test_record_without_attacker_drops_out_of_listing(self, session):
        data = await _setup_war_with_fight()
        headers = create_auth_headers(user_id=str(USER_ID))
        await _end_war(data["alliance"].id, data["war"].id, headers=headers)

        placement = await session.get(WarDefensePlacement, data["placement"].id)
        placement.attacker_champion_user_id = None
        session.add(placement)
        await session.commit()

        assert (await execute_get_request("/fight-records", headers=headers)).json()["total"] == 0

    @pytest.mark.asyncio
    async def test_record_marked_not_fought_drops_out_of_listing(self, session):
        data = await _setup_war_with_fight()
        headers = create_auth_headers(user_id=str(USER_ID))
        await _end_war(data["alliance"].id, data["war"].id, headers=headers)

        placement = await session.get(WarDefensePlacement, data["placement"].id)
        placement.is_fight_not_done = True
        session.add(placement)
        await session.commit()

        assert (await execute_get_request("/fight-records", headers=headers)).json()["total"] == 0

    @pytest.mark.asyncio
    async def test_saga_roles_edited_after_snapshot_reach_the_listing(self, session):
        data = await _setup_war_with_fight()
        season = Season(number=901)
        other_season = Season(number=902)
        await load_objects([season, other_season])
        war = await session.get(War, data["war"].id)
        war.season_id = season.id
        session.add(war)
        await session.commit()
        headers = create_auth_headers(user_id=str(USER_ID))
        await _end_war(data["alliance"].id, data["war"].id, headers=headers)

        await SagaService.upsert_role(session, season.id, data["attacker_champ"].id, True, False)
        await SagaService.upsert_role(
            session, other_season.id, data["defender_champ"].id, False, True
        )

        record = (await execute_get_request("/fight-records", headers=headers)).json()["items"][0]
        assert record["is_saga_attacker"] is True
        assert record["defender_is_saga_defender"] is False

    @pytest.mark.asyncio
    async def test_listing_shows_prefight_and_synergy_with_current_stats(self, session):
        data = await _setup_war_with_fight()
        prefight_champ = Champion(name="Iron Man", champion_class="Tech")
        synergy_champ = Champion(name="Thor", champion_class="Cosmic")
        prefight_cu = ChampionUser(
            game_account_id=data["member"].id, champion_id=prefight_champ.id, stars=6, rank=3
        )
        synergy_cu = ChampionUser(
            game_account_id=data["member"].id, champion_id=synergy_champ.id, stars=6, rank=3
        )
        await load_objects([prefight_champ, synergy_champ, prefight_cu, synergy_cu])
        await load_objects(
            [
                WarPrefightAttacker(
                    war_id=data["war"].id,
                    battlegroup=1,
                    game_account_id=data["member"].id,
                    champion_user_id=prefight_cu.id,
                    target_node_number=10,
                ),
                WarSynergyAttacker(
                    war_id=data["war"].id,
                    battlegroup=1,
                    game_account_id=data["member"].id,
                    champion_user_id=synergy_cu.id,
                    target_champion_user_id=data["attacker_cu"].id,
                ),
            ]
        )
        headers = create_auth_headers(user_id=str(USER_ID))
        await _end_war(data["alliance"].id, data["war"].id, headers=headers)

        cu = await session.get(ChampionUser, prefight_cu.id)
        cu.ascension = 1
        session.add(cu)
        await session.commit()

        record = (await execute_get_request("/fight-records", headers=headers)).json()["items"][0]
        assert [p["champion_name"] for p in record["prefights"]] == ["Iron Man"]
        assert record["prefights"][0]["ascension"] == 1
        assert [s["champion_name"] for s in record["synergies"]] == ["Thor"]


class TestFightRecordScoping:
    @pytest.mark.asyncio
    async def test_get_fight_records_member_sees_own_alliance(self):
        """Member sees records from their own alliance only."""
        data = await _setup_war_with_fight()
        headers_owner = create_auth_headers(user_id=str(USER_ID))

        await _end_war(data["alliance"].id, data["war"].id, headers=headers_owner)

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

        await _end_war(data["alliance"].id, data["war"].id, headers=headers_owner)

        visitor_user_id = uuid.uuid4()

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

        await _end_war(data["alliance"].id, data["war"].id, headers=headers_owner)

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
        await _end_war(data["alliance"].id, data["war"].id, headers=owner_headers)

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
        await _end_war(data["alliance"].id, data["war"].id, headers=owner_headers)

        admin_headers = create_auth_headers(user_id=str(USER_ID), role=Roles.ADMIN)
        response = await execute_get_request("/admin/wars/snapshot-stats", headers=admin_headers)
        assert response.status_code == 200
        body = response.json()
        assert len(body) == 1
        stat = body[0]
        assert stat["alliance_id"] == str(data["alliance"].id)
        assert stat["war_count"] == 1

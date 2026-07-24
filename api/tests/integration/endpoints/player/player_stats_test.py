"""Integration tests for the /statistics/player/* endpoints (routing + auth)."""

import uuid

import pytest

from main import app
from src.enums.Roles import Roles
from src.enums.SeasonStatus import SeasonStatus
from src.models.Season import Season
from src.models.War import War, WarStatus
from src.models.WarDefensePlacement import WarDefensePlacement
from src.models.WarFightRecord import WarFightRecord
from src.utils.db import get_session
from tests.integration.endpoints.setup.game_setup import (
    push_alliance_with_owner,
    push_champion,
    push_champion_user,
)
from tests.integration.endpoints.setup.user_setup import get_generic_user, push_user2
from tests.utils.utils_client import create_auth_headers, execute_get_request
from tests.utils.utils_constant import USER2_ID, USER_ID
from tests.utils.utils_db import get_test_session, load_objects

app.dependency_overrides[get_session] = get_test_session

USER_HEADERS = create_auth_headers(user_id=str(USER_ID), role=Roles.USER)
USER2_HEADERS = create_auth_headers(user_id=str(USER2_ID), role=Roles.USER)

PLAYER_URL = "/statistics/player"


async def _setup_with_fight():
    await load_objects([get_generic_user(is_base_id=True)])
    alliance, owner = await push_alliance_with_owner(user_id=USER_ID)
    champ = await push_champion(name="Spider-Man", champion_class="Science")
    defender = await push_champion(name="Venom", champion_class="Cosmic")
    season = Season(number=64, status=SeasonStatus.ended)
    war = War(
        id=uuid.uuid4(),
        alliance_id=alliance.id,
        opponent_name="Enemy",
        created_by_id=owner.id,
        season_id=season.id,
        status=WarStatus.ended,
    )
    await load_objects([season, war])
    cu = await push_champion_user(owner, champ)
    placement = WarDefensePlacement(
        war_id=war.id,
        battlegroup=1,
        node_number=10,
        champion_id=champ.id,
        stars=7,
        rank=3,
        attacker_champion_user_id=cu.id,
        ko_count=1,
    )
    record = WarFightRecord(
        war_id=war.id,
        alliance_id=alliance.id,
        season_id=season.id,
        game_account_id=owner.id,
        battlegroup=1,
        node_number=1,
        tier=7,
        champion_id=champ.id,
        stars=7,
        rank=3,
        ascension=0,
        is_saga_attacker=False,
        defender_champion_id=defender.id,
        defender_stars=7,
        defender_rank=3,
        defender_ascension=0,
        defender_is_saga_defender=False,
        ko_count=0,
    )
    await load_objects([placement, record])
    return {"alliance": alliance, "owner": owner, "season": season, "war": war}


@pytest.mark.anyio
async def test_owner_gets_player_seasons():
    data = await _setup_with_fight()
    resp = await execute_get_request(f"{PLAYER_URL}/{data['owner'].id}/seasons", USER_HEADERS)
    assert resp.status_code == 200
    assert any(s["number"] == 64 for s in resp.json())


@pytest.mark.anyio
async def test_owner_gets_player_stats():
    data = await _setup_with_fight()
    resp = await execute_get_request(
        f"{PLAYER_URL}/{data['owner'].id}?season_id={data['season'].id}", USER_HEADERS
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["card"]["wars_participated"] == 1
    assert body["card"]["total_kos"] == 1
    assert len(body["evolution"]) == 1


@pytest.mark.anyio
async def test_owner_gets_player_champion_usage():
    data = await _setup_with_fight()
    resp = await execute_get_request(
        f"{PLAYER_URL}/{data['owner'].id}/champion-usage?season_id={data['season'].id}",
        USER_HEADERS,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 1
    assert body[0]["champion_name"] == "Spider-Man"


@pytest.mark.anyio
async def test_other_user_gets_404_on_stats():
    data = await _setup_with_fight()
    await push_user2()
    resp = await execute_get_request(
        f"{PLAYER_URL}/{data['owner'].id}?season_id={data['season'].id}", USER2_HEADERS
    )
    assert resp.status_code == 404


@pytest.mark.anyio
async def test_unauthenticated_is_rejected():
    data = await _setup_with_fight()
    resp = await execute_get_request(f"{PLAYER_URL}/{data['owner'].id}/seasons", {})
    assert resp.status_code in (401, 403)

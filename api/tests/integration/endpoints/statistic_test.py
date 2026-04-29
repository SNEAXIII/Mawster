"""Integration tests for statistics endpoints."""

import uuid
import pytest

from main import app
from src.enums.Roles import Roles
from src.models.Season import Season
from src.models.War import War, WarStatus
from src.models.WarDefensePlacement import WarDefensePlacement
from src.utils.db import get_session
from tests.utils.utils_client import create_auth_headers, execute_get_request
from tests.utils.utils_constant import USER_ID, USER2_ID
from tests.utils.utils_db import get_test_session, load_objects, reset_test_db
from tests.integration.endpoints.setup.game_setup import (
    push_alliance_with_owner,
    push_champion,
    push_champion_user,
)
from tests.integration.endpoints.setup.user_setup import get_generic_user, push_user2

app.dependency_overrides[get_session] = get_test_session

USER_HEADERS = create_auth_headers(user_id=str(USER_ID), role=Roles.USER)
USER2_HEADERS = create_auth_headers(user_id=str(USER2_ID), role=Roles.USER)

STATS_URL = "/statistics/current_season"


@pytest.fixture(autouse=True)
def clean_db():
    reset_test_db()


async def _base_setup():
    await load_objects([get_generic_user(is_base_id=True)])
    alliance, owner = await push_alliance_with_owner(user_id=USER_ID)
    champ = await push_champion(name="Spider-Man", champion_class="Science")
    return {"alliance": alliance, "owner": owner, "champ": champ}


async def _setup_with_active_season():
    data = await _base_setup()
    season = Season(number=64, is_active=True)
    war = War(
        id=uuid.uuid4(),
        alliance_id=data["alliance"].id,
        opponent_name="Enemy",
        created_by_id=data["owner"].id,
        season_id=season.id,
        status=WarStatus.ended,
    )
    await load_objects([season, war])
    cu = await push_champion_user(data["owner"], data["champ"])
    return {**data, "season": season, "war": war, "cu": cu}


async def _add_placement(
    war_id, champion_user_id, champion_id, node_number, battlegroup=1, ko_count=0
):
    placement = WarDefensePlacement(
        war_id=war_id,
        battlegroup=battlegroup,
        node_number=node_number,
        champion_id=champion_id,
        stars=7,
        rank=3,
        attacker_champion_user_id=champion_user_id,
        ko_count=ko_count,
    )
    await load_objects([placement])
    return placement


class TestGetCurrentSeasonStatistics:
    @pytest.mark.anyio
    async def test_returns_empty_when_no_active_season(self):
        data = await _base_setup()
        response = await execute_get_request(f"{STATS_URL}/{data['alliance'].id}", USER_HEADERS)
        assert response.status_code == 200
        assert response.json() == []

    @pytest.mark.anyio
    async def test_returns_empty_when_season_is_inactive(self):
        data = await _base_setup()
        season = Season(number=64, is_active=False)
        war = War(
            id=uuid.uuid4(),
            alliance_id=data["alliance"].id,
            opponent_name="Enemy",
            created_by_id=data["owner"].id,
            season_id=season.id,
        )
        await load_objects([season, war])
        cu = await push_champion_user(data["owner"], data["champ"])
        await _add_placement(war.id, cu.id, data["champ"].id, node_number=10)

        response = await execute_get_request(f"{STATS_URL}/{data['alliance'].id}", USER_HEADERS)
        assert response.status_code == 200
        assert response.json() == []

    @pytest.mark.anyio
    async def test_returns_stats_for_player_with_fights(self):
        data = await _setup_with_active_season()
        await _add_placement(
            data["war"].id,
            data["cu"].id,
            data["champ"].id,
            node_number=10,
            battlegroup=1,
            ko_count=1,
        )
        await _add_placement(
            data["war"].id,
            data["cu"].id,
            data["champ"].id,
            node_number=11,
            battlegroup=2,
            ko_count=0,
        )

        response = await execute_get_request(f"{STATS_URL}/{data['alliance'].id}", USER_HEADERS)
        assert response.status_code == 200
        stats = response.json()
        assert len(stats) == 1
        p = stats[0]
        assert p["game_pseudo"] == data["owner"].game_pseudo
        assert p["total_fights"] == 2
        assert p["total_kos"] == 1
        assert p["ratio"] == 50  # (1 - 1/2) * 100

    @pytest.mark.anyio
    async def test_miniboss_and_boss_counted_separately(self):
        data = await _setup_with_active_season()
        # node 40 = miniboss (37-49), node 50 = boss, node 10 = regular
        await _add_placement(
            data["war"].id, data["cu"].id, data["champ"].id, node_number=40, battlegroup=1
        )
        await _add_placement(
            data["war"].id, data["cu"].id, data["champ"].id, node_number=50, battlegroup=2
        )
        await _add_placement(
            data["war"].id, data["cu"].id, data["champ"].id, node_number=10, battlegroup=3
        )

        response = await execute_get_request(f"{STATS_URL}/{data['alliance'].id}", USER_HEADERS)
        assert response.status_code == 200
        p = response.json()[0]
        assert p["total_miniboss"] == 1
        assert p["total_boss"] == 1
        assert p["total_fights"] == 3

    @pytest.mark.anyio
    async def test_score_regular_fights_no_kos(self):
        # 2 regular fights, 0 kos → score = 0*(-10) + 2*2 + 0*4 + 0*5 = 4
        data = await _setup_with_active_season()
        await _add_placement(
            data["war"].id, data["cu"].id, data["champ"].id, node_number=10, ko_count=0
        )
        await _add_placement(
            data["war"].id,
            data["cu"].id,
            data["champ"].id,
            node_number=11,
            battlegroup=2,
            ko_count=0,
        )

        response = await execute_get_request(f"{STATS_URL}/{data['alliance'].id}", USER_HEADERS)
        assert response.json()[0]["score"] == 4

    @pytest.mark.anyio
    async def test_score_penalized_by_kos(self):
        # 2 regular fights, 1 ko → score = 1*(-10) + 2*2 = -6
        data = await _setup_with_active_season()
        await _add_placement(
            data["war"].id, data["cu"].id, data["champ"].id, node_number=10, ko_count=1
        )
        await _add_placement(
            data["war"].id,
            data["cu"].id,
            data["champ"].id,
            node_number=11,
            battlegroup=2,
            ko_count=0,
        )

        response = await execute_get_request(f"{STATS_URL}/{data['alliance'].id}", USER_HEADERS)
        assert response.json()[0]["score"] == -6

    @pytest.mark.anyio
    async def test_score_with_miniboss_and_boss(self):
        # 1 regular + 1 miniboss (node 40) + 1 boss (node 50), 0 kos
        # score = 0*(-10) + 1*2 + 1*4 + 1*5 = 11
        data = await _setup_with_active_season()
        await _add_placement(
            data["war"].id, data["cu"].id, data["champ"].id, node_number=10, battlegroup=1
        )
        await _add_placement(
            data["war"].id, data["cu"].id, data["champ"].id, node_number=40, battlegroup=2
        )
        await _add_placement(
            data["war"].id, data["cu"].id, data["champ"].id, node_number=50, battlegroup=3
        )

        response = await execute_get_request(f"{STATS_URL}/{data['alliance'].id}", USER_HEADERS)
        p = response.json()[0]
        assert p["total_miniboss"] == 1
        assert p["total_boss"] == 1
        assert p["score"] == 11

    @pytest.mark.anyio
    async def test_score_not_in_response_when_no_fights(self):
        # Player with no ended-war placements → not in response at all
        data = await _setup_with_active_season()

        response = await execute_get_request(f"{STATS_URL}/{data['alliance'].id}", USER_HEADERS)
        assert response.json() == []

    @pytest.mark.anyio
    async def test_active_war_excluded(self):
        data = await _base_setup()
        season = Season(number=64, is_active=True)
        active_war = War(
            id=uuid.uuid4(),
            alliance_id=data["alliance"].id,
            opponent_name="Enemy",
            created_by_id=data["owner"].id,
            season_id=season.id,
            status=WarStatus.active,
        )
        await load_objects([season, active_war])
        cu = await push_champion_user(data["owner"], data["champ"])
        await _add_placement(active_war.id, cu.id, data["champ"].id, node_number=10)

        response = await execute_get_request(f"{STATS_URL}/{data['alliance'].id}", USER_HEADERS)
        assert response.status_code == 200
        assert response.json() == []

    @pytest.mark.anyio
    async def test_only_ended_wars_counted_when_mixed(self):
        """Ended war placements are counted; active war placements are excluded."""
        data = await _base_setup()
        season = Season(number=64, is_active=True)
        ended_war = War(
            id=uuid.uuid4(),
            alliance_id=data["alliance"].id,
            opponent_name="Ended",
            created_by_id=data["owner"].id,
            season_id=season.id,
            status=WarStatus.ended,
        )
        active_war = War(
            id=uuid.uuid4(),
            alliance_id=data["alliance"].id,
            opponent_name="Active",
            created_by_id=data["owner"].id,
            season_id=season.id,
            status=WarStatus.active,
        )
        await load_objects([season, ended_war, active_war])
        cu = await push_champion_user(data["owner"], data["champ"])
        await _add_placement(ended_war.id, cu.id, data["champ"].id, node_number=10, ko_count=0)
        await _add_placement(active_war.id, cu.id, data["champ"].id, node_number=11, ko_count=1)

        response = await execute_get_request(f"{STATS_URL}/{data['alliance'].id}", USER_HEADERS)
        assert response.status_code == 200
        row = response.json()[0]
        assert row["total_fights"] == 1
        assert row["total_kos"] == 0
        assert row["ratio"] == 100

    @pytest.mark.anyio
    async def test_non_member_gets_404(self):
        data = await _base_setup()
        await push_user2()
        response = await execute_get_request(f"{STATS_URL}/{data['alliance'].id}", USER2_HEADERS)
        assert response.status_code == 404

    @pytest.mark.anyio
    async def test_unknown_alliance_gets_404(self):
        await load_objects([get_generic_user(is_base_id=True)])
        response = await execute_get_request(f"{STATS_URL}/{uuid.uuid4()}", USER_HEADERS)
        assert response.status_code == 404

"""Integration tests for GET /alliances/{id}/ranking-history."""

import uuid
import pytest

from main import app
from src.enums.Roles import Roles
from src.models.Season import Season
from src.models.War import War, WarStatus
from src.utils.db import get_session
from tests.utils.utils_client import create_auth_headers, execute_get_request
from tests.utils.utils_constant import USER_ID, USER2_ID
from tests.utils.utils_db import get_test_session, load_objects, reset_test_db
from tests.integration.endpoints.setup.game_setup import push_alliance_with_owner, push_visitor
from tests.integration.endpoints.setup.user_setup import get_generic_user

app.dependency_overrides[get_session] = get_test_session

USER3_ID = uuid.uuid4()

OWNER_HEADERS = create_auth_headers(user_id=str(USER_ID), role=Roles.USER)
STRANGER_HEADERS = create_auth_headers(user_id=str(USER2_ID), role=Roles.USER)
VISITOR_HEADERS = create_auth_headers(user_id=str(USER3_ID), role=Roles.USER)


def _url(alliance_id: uuid.UUID) -> str:
    return f"/alliances/{alliance_id}/ranking-history"


@pytest.fixture(autouse=True)
def clean_db():
    reset_test_db()


async def _base_setup():
    await load_objects([get_generic_user(is_base_id=True)])
    alliance, owner = await push_alliance_with_owner(user_id=USER_ID)
    return alliance, owner


async def _setup_wars(alliance, owner, elo_changes: list[int | None]):
    season = Season(number=64, is_active=True)
    await load_objects([season])
    wars = []
    for i, change in enumerate(elo_changes):
        w = War(
            id=uuid.uuid4(),
            alliance_id=alliance.id,
            opponent_name=f"Enemy{i + 1}",
            created_by_id=owner.id,
            season_id=season.id,
            status=WarStatus.ended,
            elo_change=change,
            tier=5,
            win=change is not None and change > 0,
        )
        wars.append(w)
    await load_objects(wars)
    return season, wars


class TestRankingHistoryAuth:
    @pytest.mark.anyio
    async def test_unauthenticated_returns_401(self):
        alliance, _ = await _base_setup()
        resp = await execute_get_request(_url(alliance.id), headers={})
        assert resp.status_code == 401

    @pytest.mark.anyio
    async def test_stranger_returns_404(self):
        alliance, _ = await _base_setup()
        u2 = get_generic_user(login="user2", email="u2@mail.com")
        u2.id = USER2_ID
        u2.discord_id = "discord_stranger"
        await load_objects([u2])
        resp = await execute_get_request(_url(alliance.id), headers=STRANGER_HEADERS)
        assert resp.status_code == 404

    @pytest.mark.anyio
    async def test_visitor_can_access(self):
        alliance, _ = await _base_setup()
        u3 = get_generic_user(login="user3", email="u3@mail.com")
        u3.id = USER3_ID
        u3.discord_id = "discord_visitor"
        await load_objects([u3])
        await push_visitor(alliance, user_id=USER3_ID)
        resp = await execute_get_request(_url(alliance.id), headers=VISITOR_HEADERS)
        assert resp.status_code == 200

    @pytest.mark.anyio
    async def test_owner_can_access(self):
        alliance, _ = await _base_setup()
        resp = await execute_get_request(_url(alliance.id), headers=OWNER_HEADERS)
        assert resp.status_code == 200


class TestRankingHistoryData:
    @pytest.mark.anyio
    async def test_no_active_season_returns_empty(self):
        alliance, _ = await _base_setup()
        resp = await execute_get_request(_url(alliance.id), headers=OWNER_HEADERS)
        data = resp.json()
        assert data["points"] == []
        assert data["season_number"] is None

    @pytest.mark.anyio
    async def test_active_season_no_wars_returns_empty(self):
        alliance, _ = await _base_setup()
        season = Season(number=64, is_active=True)
        await load_objects([season])
        resp = await execute_get_request(_url(alliance.id), headers=OWNER_HEADERS)
        data = resp.json()
        assert data["points"] == []
        assert data["season_number"] == 64

    @pytest.mark.anyio
    async def test_wars_elo_reconstruction(self):
        alliance, owner = await _base_setup()
        alliance.elo = 1020
        await load_objects([alliance])
        await _setup_wars(alliance, owner, elo_changes=[50, -30])
        resp = await execute_get_request(_url(alliance.id), headers=OWNER_HEADERS)
        data = resp.json()
        assert data["season_number"] == 64
        points = data["points"]
        assert len(points) == 2
        assert points[0]["war_number"] == 1
        assert points[1]["war_number"] == 2
        assert points[0]["opponent_name"] == "Enemy1"
        # current_elo=1020; W2.elo_change=-30 → W1.elo_after=1020-(-30)=1050; W2.elo_after=1020
        assert points[0]["elo_after"] == 1050
        assert points[1]["elo_after"] == 1020

    @pytest.mark.anyio
    async def test_active_war_excluded(self):
        alliance, owner = await _base_setup()
        season = Season(number=64, is_active=True)
        active_war = War(
            id=uuid.uuid4(),
            alliance_id=alliance.id,
            opponent_name="Ongoing",
            created_by_id=owner.id,
            season_id=season.id,
            status=WarStatus.active,
        )
        await load_objects([season, active_war])
        resp = await execute_get_request(_url(alliance.id), headers=OWNER_HEADERS)
        data = resp.json()
        assert data["points"] == []

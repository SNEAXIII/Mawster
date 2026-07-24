"""Integration test proving the roster endpoint reflects the CURRENT season's saga flags.

A champion flagged as saga attacker/defender for the current season (via the
admin PUT /admin/seasons/{season_id}/saga/{champion_id} endpoint) must show
up with the matching flags on GET /champion-users/by-account/{id}.
"""

import pytest

from main import app
from src.enums.Roles import Roles
from src.utils.db import get_session
from tests.integration.endpoints.setup.game_setup import push_champion, push_game_account
from tests.integration.endpoints.setup.user_setup import push_one_user
from tests.utils.utils_client import (
    create_auth_headers,
    execute_get_request,
    execute_post_request,
    execute_put_request,
)
from tests.utils.utils_constant import GAME_PSEUDO, USER_ID
from tests.utils.utils_db import get_test_session

app.dependency_overrides[get_session] = get_test_session

USER_HEADERS = create_auth_headers()
ADMIN_HEADERS = create_auth_headers(user_id=str(USER_ID), role=Roles.ADMIN)

SEASONS_URL = "/admin/seasons"
CHAMPION_USERS_ROUTE = "/champion-users"


@pytest.mark.asyncio
async def test_roster_reflects_current_season_saga():
    await push_one_user()
    acc = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
    champ = await push_champion("Hercules", "Cosmic")

    season_resp = await execute_post_request(SEASONS_URL, {"number": 900}, ADMIN_HEADERS)
    assert season_resp.status_code == 201
    season_id = season_resp.json()["id"]

    from tests.integration.endpoints.setup.game_setup import push_champion_user

    await push_champion_user(acc, champ, stars=7, rank=3)

    saga_resp = await execute_put_request(
        f"{SEASONS_URL}/{season_id}/saga/{champ.id}",
        {"is_saga_attacker": True, "is_saga_defender": False},
        ADMIN_HEADERS,
    )
    assert saga_resp.status_code == 200

    r = await execute_get_request(
        f"{CHAMPION_USERS_ROUTE}/by-account/{acc.id}", headers=USER_HEADERS
    )
    assert r.status_code == 200
    entry = next(e for e in r.json() if e["champion_id"] == str(champ.id))
    assert entry["is_saga_attacker"] is True
    assert entry["is_saga_defender"] is False


@pytest.mark.asyncio
async def test_roster_defaults_false_without_saga_role():
    """A champion with no ChampionSagaRole row for the current season defaults to False."""
    await push_one_user()
    acc = await push_game_account(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
    champ = await push_champion("Storm", "Mutant")

    from tests.integration.endpoints.setup.game_setup import push_champion_user

    await push_champion_user(acc, champ, stars=6, rank=4)

    r = await execute_get_request(
        f"{CHAMPION_USERS_ROUTE}/by-account/{acc.id}", headers=USER_HEADERS
    )
    assert r.status_code == 200
    entry = next(e for e in r.json() if e["champion_id"] == str(champ.id))
    assert entry["is_saga_attacker"] is False
    assert entry["is_saga_defender"] is False

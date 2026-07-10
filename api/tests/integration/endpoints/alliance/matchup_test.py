"""Integration tests for the matchup rating endpoints.

Every test here is skipped until Task 6 wires `matchup_controller` into the router list.
They are written now, while the behaviour is fresh, and switched on in one move later.
"""

import uuid

import pytest

# TODO(task-6): delete this marker and its `pytestmark` use once the controller is registered.
pytestmark = pytest.mark.skip(reason="TODO(task-6): matchup_controller not registered yet")

from main import app  # noqa: E402
from src.enums.MatchupTargetType import MatchupTargetType  # noqa: E402
from src.enums.MatchupVerdict import MatchupVerdict  # noqa: E402
from src.utils.db import get_session  # noqa: E402
from tests.integration.endpoints.setup.game_setup import (  # noqa: E402
    push_alliance_with_owner,
    push_champion,
)
from tests.integration.endpoints.setup.user_setup import get_generic_user  # noqa: E402
from tests.utils.utils_client import (  # noqa: E402
    create_auth_headers,
    execute_get_request,
    execute_post_request,
)
from tests.utils.utils_constant import USER_ID  # noqa: E402
from tests.utils.utils_db import get_test_session, load_objects  # noqa: E402

app.dependency_overrides[get_session] = get_test_session

HEADERS_OWNER = create_auth_headers(user_id=str(USER_ID))


async def _setup_alliance_with_champions():
    await load_objects([get_generic_user(is_base_id=True)])
    alliance, owner = await push_alliance_with_owner()
    attacker = await push_champion(name="Doctor Doom", champion_class="Mystic")
    defender = await push_champion(name="Korg", champion_class="Cosmic")
    return alliance, owner, attacker, defender


@pytest.mark.asyncio
async def test_upsert_writes_one_row_per_target():
    alliance, _owner, attacker, defender = await _setup_alliance_with_champions()
    payload = {
        "champion_id": str(attacker.id),
        "targets": [
            {
                "target_type": MatchupTargetType.DEFENDER.value,
                "defender_champion_id": str(defender.id),
                "verdict": MatchupVerdict.OK.value,
            },
            {
                "target_type": MatchupTargetType.NODE.value,
                "node_number": 1,
                "verdict": MatchupVerdict.GOOD.value,
            },
        ],
    }
    response = await execute_post_request(
        f"/alliances/{alliance.id}/matchups", payload, HEADERS_OWNER
    )
    assert response.status_code == 201
    assert len(response.json()) == 2

    listing = await execute_get_request(f"/alliances/{alliance.id}/matchups", HEADERS_OWNER)
    assert len(listing.json()) == 2


@pytest.mark.asyncio
async def test_upsert_overwrites_the_same_target_instead_of_duplicating():
    alliance, _owner, attacker, defender = await _setup_alliance_with_champions()
    route = f"/alliances/{alliance.id}/matchups"
    target = {
        "target_type": MatchupTargetType.DEFENDER.value,
        "defender_champion_id": str(defender.id),
    }

    await execute_post_request(
        route,
        {"champion_id": str(attacker.id), "targets": [{**target, "verdict": "ok"}]},
        HEADERS_OWNER,
    )
    await execute_post_request(
        route,
        {"champion_id": str(attacker.id), "targets": [{**target, "verdict": "discouraged"}]},
        HEADERS_OWNER,
    )

    listing = await execute_get_request(route, HEADERS_OWNER)
    body = listing.json()
    assert len(body) == 1
    assert body[0]["verdict"] == "discouraged"


@pytest.mark.asyncio
async def test_upsert_rejects_three_synergies():
    alliance, _owner, attacker, defender = await _setup_alliance_with_champions()
    payload = {
        "champion_id": str(attacker.id),
        "targets": [
            {
                "target_type": MatchupTargetType.DEFENDER.value,
                "defender_champion_id": str(defender.id),
                "verdict": "good",
                "synergies": [{"champion_id": str(uuid.uuid4())} for _ in range(3)],
            }
        ],
    }
    response = await execute_post_request(
        f"/alliances/{alliance.id}/matchups", payload, HEADERS_OWNER
    )
    assert response.status_code == 422

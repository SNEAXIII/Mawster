"""Integration tests for POST /alliances/{alliance_id}/fight-records/import."""

import uuid
import pytest

from tests.integration.endpoints.setup.game_setup import (
    push_alliance_with_owner,
    push_member,
    push_officer,
)
from tests.integration.endpoints.setup.user_setup import get_generic_user
from tests.utils.utils_client import create_auth_headers, execute_post_request
from tests.utils.utils_constant import USER_ID, USER2_ID, USER2_LOGIN, USER2_EMAIL, DISCORD_ID_2
from tests.utils.utils_db import load_objects

HEADERS_USER1 = create_auth_headers(user_id=str(USER_ID))
HEADERS_USER2 = create_auth_headers(user_id=str(USER2_ID))


async def _setup_two_users():
    u1 = get_generic_user(is_base_id=True)
    u2 = get_generic_user(login=USER2_LOGIN, email=USER2_EMAIL)
    u2.id = USER2_ID
    u2.discord_id = DISCORD_ID_2
    await load_objects([u1, u2])


class TestImportFightRecords:
    @pytest.mark.asyncio
    async def test_officer_can_import(self, officer_with_champions):
        alliance_id, officer_acc_id, champ_id, defender_id, season_id = officer_with_champions
        payload = {
            "rows": [
                {
                    "champion_id": str(champ_id),
                    "defender_champion_id": str(defender_id),
                    "node_number": 15,
                    "season_name": "S1",
                    "ko_count": 2,
                }
            ]
        }
        url = f"/alliances/{alliance_id}/fight-records/import"
        response = await execute_post_request(url, payload, HEADERS_USER2)
        assert response.status_code == 201
        assert response.json()["imported"] == 1

    @pytest.mark.asyncio
    async def test_owner_can_import(self, owner_with_champions):
        alliance_id, champ_id, defender_id, season_id = owner_with_champions
        payload = {
            "rows": [
                {
                    "champion_id": str(champ_id),
                    "defender_champion_id": str(defender_id),
                    "node_number": 15,
                    "season_name": "S1",
                    "ko_count": 0,
                }
            ]
        }
        url = f"/alliances/{alliance_id}/fight-records/import"
        response = await execute_post_request(url, payload, HEADERS_USER1)
        assert response.status_code == 201

    @pytest.mark.asyncio
    async def test_member_cannot_import(self, member_with_champions):
        alliance_id, champ_id, defender_id, season_id = member_with_champions
        payload = {
            "rows": [
                {
                    "champion_id": str(champ_id),
                    "defender_champion_id": str(defender_id),
                    "node_number": 15,
                    "season_name": "S1",
                    "ko_count": 0,
                }
            ]
        }
        url = f"/alliances/{alliance_id}/fight-records/import"
        response = await execute_post_request(url, payload, HEADERS_USER2)
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_unknown_season_returns_422(self, officer_with_champions):
        alliance_id, officer_acc_id, champ_id, defender_id, season_id = officer_with_champions
        payload = {
            "rows": [
                {
                    "champion_id": str(champ_id),
                    "defender_champion_id": str(defender_id),
                    "node_number": 15,
                    "season_name": "S999",
                    "ko_count": 0,
                }
            ]
        }
        url = f"/alliances/{alliance_id}/fight-records/import"
        response = await execute_post_request(url, payload, HEADERS_USER2)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_wrong_alliance_returns_403(self, officer_with_champions):
        other_alliance_id = uuid.uuid4()
        alliance_id, officer_acc_id, champ_id, defender_id, season_id = officer_with_champions
        payload = {
            "rows": [
                {
                    "champion_id": str(champ_id),
                    "defender_champion_id": str(defender_id),
                    "node_number": 15,
                    "season_name": "S1",
                    "ko_count": 0,
                }
            ]
        }
        url = f"/alliances/{other_alliance_id}/fight-records/import"
        response = await execute_post_request(url, payload, HEADERS_USER2)
        assert response.status_code == 403


@pytest.fixture
async def owner_with_champions():
    from src.models.Season import Season
    from src.models.Champion import Champion

    await load_objects([get_generic_user(is_base_id=True)])
    alliance, owner_acc = await push_alliance_with_owner(user_id=USER_ID)
    season = Season(number=1, is_active=True)
    champ = Champion(
        name="Magik", champion_class="Mystic", is_saga_attacker=False, is_saga_defender=False
    )
    defender = Champion(
        name="Serpent", champion_class="Cosmic", is_saga_attacker=False, is_saga_defender=False
    )
    await load_objects([season, champ, defender])
    return alliance.id, champ.id, defender.id, season.id


@pytest.fixture
async def officer_with_champions():
    from src.models.Season import Season
    from src.models.Champion import Champion

    await _setup_two_users()
    alliance, _ = await push_alliance_with_owner(user_id=USER_ID)
    officer_acc = await push_member(alliance=alliance, user_id=USER2_ID)
    await push_officer(alliance=alliance, game_account=officer_acc)
    season = Season(number=1, is_active=True)
    champ = Champion(
        name="Magik", champion_class="Mystic", is_saga_attacker=False, is_saga_defender=False
    )
    defender = Champion(
        name="Serpent", champion_class="Cosmic", is_saga_attacker=False, is_saga_defender=False
    )
    await load_objects([season, champ, defender])
    return alliance.id, officer_acc.id, champ.id, defender.id, season.id


@pytest.fixture
async def member_with_champions():
    from src.models.Season import Season
    from src.models.Champion import Champion

    await _setup_two_users()
    alliance, _ = await push_alliance_with_owner(user_id=USER_ID)
    await push_member(alliance=alliance, user_id=USER2_ID)
    season = Season(number=1, is_active=True)
    champ = Champion(
        name="Magik", champion_class="Mystic", is_saga_attacker=False, is_saga_defender=False
    )
    defender = Champion(
        name="Serpent", champion_class="Cosmic", is_saga_attacker=False, is_saga_defender=False
    )
    await load_objects([season, champ, defender])
    return alliance.id, champ.id, defender.id, season.id

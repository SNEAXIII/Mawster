"""Integration tests for the alliance-wide roster endpoint."""

import uuid
import pytest

from main import app
from src.utils.db import get_session
from tests.integration.endpoints.setup.user_setup import get_generic_user
from tests.integration.endpoints.setup.game_setup import (
    push_alliance_with_owner,
    push_visitor,
    push_champion,
    push_champion_user,
)
from tests.utils.utils_client import create_auth_headers, execute_get_request
from tests.utils.utils_constant import (
    USER_ID,
    USER2_ID,
    USER2_LOGIN,
    USER2_EMAIL,
    DISCORD_ID_2,
    GAME_PSEUDO,
    GAME_PSEUDO_2,
)
from tests.utils.utils_db import get_test_session, load_objects

app.dependency_overrides[get_session] = get_test_session

HEADERS_OWNER = create_auth_headers(user_id=str(USER_ID))
HEADERS_VISITOR = create_auth_headers(user_id=str(USER2_ID))
OUTSIDER_ID = uuid.uuid4()
HEADERS_OUTSIDER = create_auth_headers(user_id=str(OUTSIDER_ID))


async def _setup_users():
    u1 = get_generic_user(is_base_id=True)
    u2 = get_generic_user(login=USER2_LOGIN, email=USER2_EMAIL)
    u2.id = USER2_ID
    u2.discord_id = DISCORD_ID_2
    u3 = get_generic_user(login="outsider", email="outsider@test.com")
    u3.id = OUTSIDER_ID
    u3.discord_id = "discord_outsider"
    await load_objects([u1, u2, u3])


class TestAllianceRoster:
    @pytest.mark.asyncio
    async def test_owner_sees_all_member_entries_with_pseudo(self):
        await _setup_users()
        alliance, owner_acc = await push_alliance_with_owner(
            user_id=USER_ID, game_pseudo=GAME_PSEUDO
        )
        champ = await push_champion(name="Hercules", champion_class="Cosmic")
        entry = await push_champion_user(owner_acc, champ, stars=7, rank=3, signature=200)

        response = await execute_get_request(
            f"/alliances/{alliance.id}/roster", headers=HEADERS_OWNER
        )
        assert response.status_code == 200
        body = response.json()
        assert len(body) == 1
        row = body[0]
        assert row["id"] == str(entry.id)
        assert row["game_account_id"] == str(owner_acc.id)
        assert row["game_pseudo"] == GAME_PSEUDO
        assert row["champion_name"] == "Hercules"
        assert row["rarity"] == "7r3"
        assert row["signature"] == 200

    @pytest.mark.asyncio
    async def test_visitor_can_view(self):
        await _setup_users()
        alliance, owner_acc = await push_alliance_with_owner(
            user_id=USER_ID, game_pseudo=GAME_PSEUDO
        )
        await push_visitor(alliance=alliance, user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)
        champ = await push_champion(name="Hercules", champion_class="Cosmic")
        await push_champion_user(owner_acc, champ, stars=7, rank=3)

        response = await execute_get_request(
            f"/alliances/{alliance.id}/roster", headers=HEADERS_VISITOR
        )
        assert response.status_code == 200
        assert len(response.json()) == 1

    @pytest.mark.asyncio
    async def test_outsider_forbidden(self):
        await _setup_users()
        alliance, _ = await push_alliance_with_owner(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        response = await execute_get_request(
            f"/alliances/{alliance.id}/roster", headers=HEADERS_OUTSIDER
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_multistar_ownership_yields_two_rows(self):
        await _setup_users()
        alliance, owner_acc = await push_alliance_with_owner(
            user_id=USER_ID, game_pseudo=GAME_PSEUDO
        )
        champ = await push_champion(name="Hercules", champion_class="Cosmic")
        await push_champion_user(owner_acc, champ, stars=6, rank=5)
        await push_champion_user(owner_acc, champ, stars=7, rank=2)

        response = await execute_get_request(
            f"/alliances/{alliance.id}/roster", headers=HEADERS_OWNER
        )
        body = response.json()
        rarities = sorted(r["rarity"] for r in body)
        assert rarities == ["6r5", "7r2"]

    @pytest.mark.asyncio
    async def test_empty_roster(self):
        await _setup_users()
        alliance, _ = await push_alliance_with_owner(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        response = await execute_get_request(
            f"/alliances/{alliance.id}/roster", headers=HEADERS_OWNER
        )
        assert response.status_code == 200
        assert response.json() == []

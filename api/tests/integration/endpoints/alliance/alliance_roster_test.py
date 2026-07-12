"""Integration tests for the alliance-wide roster endpoint."""

import uuid
import pytest

from main import app
from src.utils.db import get_session
from tests.integration.endpoints.setup.user_setup import get_generic_user
from src.models.ChampionUser import ChampionUser
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
        champ = await push_champion(name="Hercules", champion_class="Cosmic", alias="Herc")
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
        assert row["alias"] == "Herc"
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


class TestAllianceRosterFilters:
    """Server-side filtering + the distinct-champion cap used by champion-search."""

    async def _alliance_with_three_champs(self):
        await _setup_users()
        alliance, owner_acc = await push_alliance_with_owner(
            user_id=USER_ID, game_pseudo=GAME_PSEUDO
        )
        herc = await push_champion(name="Hercules", champion_class="Cosmic", alias="Herc")
        doom = await push_champion(name="Doctor Doom", champion_class="Mystic")
        beast = await push_champion(name="Beast", champion_class="Mutant")
        await push_champion_user(owner_acc, herc, stars=7, rank=5, ascension=1)
        await push_champion_user(owner_acc, doom, stars=7, rank=2, ascension=0)
        await push_champion_user(owner_acc, beast, stars=6, rank=5, ascension=0)
        return alliance, owner_acc, (herc, doom, beast)

    @pytest.mark.asyncio
    async def test_name_filter_matches_alias(self):
        alliance, *_ = await self._alliance_with_three_champs()
        response = await execute_get_request(
            f"/alliances/{alliance.id}/roster?name=herc", headers=HEADERS_OWNER
        )
        body = response.json()
        assert [r["champion_name"] for r in body] == ["Hercules"]

    @pytest.mark.asyncio
    async def test_name_filter_no_match(self):
        alliance, *_ = await self._alliance_with_three_champs()
        response = await execute_get_request(
            f"/alliances/{alliance.id}/roster?name=zzzz", headers=HEADERS_OWNER
        )
        assert response.json() == []

    @pytest.mark.asyncio
    async def test_class_filter(self):
        alliance, *_ = await self._alliance_with_three_champs()
        response = await execute_get_request(
            f"/alliances/{alliance.id}/roster?champion_class=Mutant", headers=HEADERS_OWNER
        )
        assert [r["champion_name"] for r in response.json()] == ["Beast"]

    @pytest.mark.asyncio
    async def test_rank_filter_matches_stars_and_rank(self):
        alliance, *_ = await self._alliance_with_three_champs()
        response = await execute_get_request(
            f"/alliances/{alliance.id}/roster?ranks=7r5", headers=HEADERS_OWNER
        )
        rarities = sorted(r["rarity"] for r in response.json())
        assert rarities == ["7r5"]  # Hercules 7r5, but not Beast 6r5

    @pytest.mark.asyncio
    async def test_ascension_filter(self):
        alliance, *_ = await self._alliance_with_three_champs()
        response = await execute_get_request(
            f"/alliances/{alliance.id}/roster?ascensions=1", headers=HEADERS_OWNER
        )
        assert [r["champion_name"] for r in response.json()] == ["Hercules"]

    @pytest.mark.asyncio
    async def test_preferred_attacker_filter(self):
        await _setup_users()
        alliance, owner_acc = await push_alliance_with_owner(
            user_id=USER_ID, game_pseudo=GAME_PSEUDO
        )
        herc = await push_champion(name="Hercules", champion_class="Cosmic")
        doom = await push_champion(name="Doctor Doom", champion_class="Mystic")
        await load_objects(
            [
                ChampionUser(
                    game_account_id=owner_acc.id,
                    champion_id=herc.id,
                    stars=7,
                    rank=5,
                    is_preferred_attacker=True,
                ),
                ChampionUser(
                    game_account_id=owner_acc.id,
                    champion_id=doom.id,
                    stars=7,
                    rank=5,
                    is_preferred_attacker=False,
                ),
            ]
        )
        response = await execute_get_request(
            f"/alliances/{alliance.id}/roster?preferred_attacker=true", headers=HEADERS_OWNER
        )
        assert [r["champion_name"] for r in response.json()] == ["Hercules"]

    @pytest.mark.asyncio
    async def test_distinct_champion_limit_caps_alphabetically(self):
        alliance, *_ = await self._alliance_with_three_champs()
        response = await execute_get_request(
            f"/alliances/{alliance.id}/roster?distinct_champion_limit=2",
            headers=HEADERS_OWNER,
        )
        names = sorted({r["champion_name"] for r in response.json()})
        # 3 champions exist; only the first 2 alphabetically are returned.
        assert names == ["Beast", "Doctor Doom"]

    @pytest.mark.asyncio
    async def test_distinct_limit_keeps_all_instances_of_a_champion(self):
        await _setup_users()
        alliance, owner_acc = await push_alliance_with_owner(
            user_id=USER_ID, game_pseudo=GAME_PSEUDO
        )
        herc = await push_champion(name="Hercules", champion_class="Cosmic")
        await push_champion_user(owner_acc, herc, stars=6, rank=5)
        await push_champion_user(owner_acc, herc, stars=7, rank=2)
        response = await execute_get_request(
            f"/alliances/{alliance.id}/roster?distinct_champion_limit=1",
            headers=HEADERS_OWNER,
        )
        body = response.json()
        assert sorted(r["rarity"] for r in body) == ["6r5", "7r2"]

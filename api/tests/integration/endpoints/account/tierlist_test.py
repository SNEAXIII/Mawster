"""Integration tests for /tierlists endpoints."""

import uuid

import pytest

from main import app
from src.enums.Roles import Roles
from src.services.account.TierListService import MAX_TIER_LISTS_PER_USER
from src.utils.db import get_session
from tests.integration.endpoints.setup.game_setup import push_champion
from tests.integration.endpoints.setup.user_setup import get_generic_user, push_user2
from tests.utils.utils_client import (
    create_auth_headers,
    execute_delete_request,
    execute_get_request,
    execute_post_request,
    execute_put_request,
)
from tests.utils.utils_constant import USER2_ID, USER_ID
from tests.utils.utils_db import get_test_session, load_objects

app.dependency_overrides[get_session] = get_test_session

USER_HEADERS = create_auth_headers(user_id=str(USER_ID), role=Roles.USER)
USER2_HEADERS = create_auth_headers(user_id=str(USER2_ID), role=Roles.USER)

BASE_URL = "/tierlists"


async def _setup_user():
    await load_objects([get_generic_user(is_base_id=True)])


def _tier(champion_ids: list[str] | None = None, label: str = "S", color: str = "#ff0000") -> dict:
    return {"label": label, "color": color, "champion_ids": champion_ids or []}


def _payload(
    tiers: list[dict] | None = None, tags: list[dict] | None = None, title: str = "My List"
) -> dict:
    return {"title": title, "tiers": tiers or [_tier()], "tags": tags or []}


class TestCreateTierList:
    @pytest.mark.anyio
    async def test_create_ok(self):
        await _setup_user()
        champion = await push_champion(name="Spider-Man")

        response = await execute_post_request(
            BASE_URL, _payload(tiers=[_tier([str(champion.id)])]), USER_HEADERS
        )

        assert response.status_code == 201
        data = response.json()
        assert data["title"] == "My List"
        assert len(data["tiers"]) == 1
        assert data["tiers"][0]["champion_ids"] == [str(champion.id)]

    @pytest.mark.anyio
    async def test_unknown_champion_returns_400(self):
        await _setup_user()

        response = await execute_post_request(
            BASE_URL, _payload(tiers=[_tier([str(uuid.uuid4())])]), USER_HEADERS
        )

        assert response.status_code == 400

    @pytest.mark.anyio
    async def test_21st_tier_list_returns_409(self):
        await _setup_user()
        for _ in range(MAX_TIER_LISTS_PER_USER):
            response = await execute_post_request(BASE_URL, _payload(), USER_HEADERS)
            assert response.status_code == 201

        response = await execute_post_request(BASE_URL, _payload(), USER_HEADERS)

        assert response.status_code == 409

    @pytest.mark.anyio
    async def test_without_auth_returns_401(self):
        response = await execute_post_request(BASE_URL, _payload(), {})
        assert response.status_code == 401


class TestListTierLists:
    @pytest.mark.anyio
    async def test_empty_list(self):
        await _setup_user()

        response = await execute_get_request(BASE_URL, USER_HEADERS)

        assert response.status_code == 200
        assert response.json() == []

    @pytest.mark.anyio
    async def test_lists_summaries_with_counts(self):
        await _setup_user()
        champion = await push_champion(name="Spider-Man")
        champion2 = await push_champion(name="Doctor Doom")
        await execute_post_request(
            BASE_URL,
            _payload(tiers=[_tier([str(champion.id), str(champion2.id)]), _tier(label="A")]),
            USER_HEADERS,
        )

        response = await execute_get_request(BASE_URL, USER_HEADERS)

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["tier_count"] == 2
        assert data[0]["ranked_champion_count"] == 2

    @pytest.mark.anyio
    async def test_without_auth_returns_401(self):
        response = await execute_get_request(BASE_URL, {})
        assert response.status_code == 401


class TestGetTierList:
    @pytest.mark.anyio
    async def test_get_ok(self):
        await _setup_user()
        champion = await push_champion(name="Spider-Man")
        created = (
            await execute_post_request(
                BASE_URL, _payload(tiers=[_tier([str(champion.id)])]), USER_HEADERS
            )
        ).json()

        response = await execute_get_request(f"{BASE_URL}/{created['id']}", USER_HEADERS)

        assert response.status_code == 200
        assert response.json()["id"] == created["id"]

    @pytest.mark.anyio
    async def test_unknown_id_returns_404(self):
        await _setup_user()

        response = await execute_get_request(f"{BASE_URL}/{uuid.uuid4()}", USER_HEADERS)

        assert response.status_code == 404

    @pytest.mark.anyio
    async def test_owned_by_another_user_returns_404(self):
        await _setup_user()
        await push_user2()
        created = (await execute_post_request(BASE_URL, _payload(), USER_HEADERS)).json()

        response = await execute_get_request(f"{BASE_URL}/{created['id']}", USER2_HEADERS)

        assert response.status_code == 404

    @pytest.mark.anyio
    async def test_without_auth_returns_401(self):
        response = await execute_get_request(f"{BASE_URL}/{uuid.uuid4()}", {})
        assert response.status_code == 401


class TestReplaceTierList:
    @pytest.mark.anyio
    async def test_put_replaces_whole_list_and_round_trips_order(self):
        await _setup_user()
        champ_a = await push_champion(name="Champ A")
        champ_b = await push_champion(name="Champ B")
        champ_c = await push_champion(name="Champ C")
        created = (
            await execute_post_request(
                BASE_URL,
                _payload(tiers=[_tier([str(champ_a.id), str(champ_b.id)], label="S")]),
                USER_HEADERS,
            )
        ).json()

        # Remove champ_a, keep champ_b, add champ_c in a new tier placed first.
        new_payload = _payload(
            tiers=[
                _tier([str(champ_c.id)], label="X", color="#111111"),
                _tier([str(champ_b.id)], label="S", color="#ff0000"),
            ]
        )
        response = await execute_put_request(
            f"{BASE_URL}/{created['id']}", new_payload, USER_HEADERS
        )

        assert response.status_code == 200
        data = response.json()
        assert [t["label"] for t in data["tiers"]] == ["X", "S"]
        assert [t["position"] for t in data["tiers"]] == [0, 1]
        assert data["tiers"][0]["champion_ids"] == [str(champ_c.id)]
        assert data["tiers"][1]["champion_ids"] == [str(champ_b.id)]
        all_ranked = {cid for t in data["tiers"] for cid in t["champion_ids"]}
        assert str(champ_a.id) not in all_ranked

    @pytest.mark.anyio
    async def test_champion_order_inside_a_tier_round_trips(self):
        await _setup_user()
        champ_a = await push_champion(name="Champ A")
        champ_b = await push_champion(name="Champ B")
        created = (await execute_post_request(BASE_URL, _payload(), USER_HEADERS)).json()

        response = await execute_put_request(
            f"{BASE_URL}/{created['id']}",
            _payload(tiers=[_tier([str(champ_b.id), str(champ_a.id)])]),
            USER_HEADERS,
        )

        assert response.status_code == 200
        assert response.json()["tiers"][0]["champion_ids"] == [str(champ_b.id), str(champ_a.id)]

    @pytest.mark.anyio
    async def test_owned_by_another_user_returns_404(self):
        await _setup_user()
        await push_user2()
        created = (await execute_post_request(BASE_URL, _payload(), USER_HEADERS)).json()

        response = await execute_put_request(
            f"{BASE_URL}/{created['id']}", _payload(), USER2_HEADERS
        )

        assert response.status_code == 404

    @pytest.mark.anyio
    async def test_unknown_champion_returns_400(self):
        await _setup_user()
        created = (await execute_post_request(BASE_URL, _payload(), USER_HEADERS)).json()

        response = await execute_put_request(
            f"{BASE_URL}/{created['id']}",
            _payload(tiers=[_tier([str(uuid.uuid4())])]),
            USER_HEADERS,
        )

        assert response.status_code == 400

    @pytest.mark.anyio
    async def test_without_auth_returns_401(self):
        response = await execute_put_request(f"{BASE_URL}/{uuid.uuid4()}", _payload(), {})
        assert response.status_code == 401


class TestDeleteTierList:
    @pytest.mark.anyio
    async def test_delete_ok(self):
        await _setup_user()
        created = (await execute_post_request(BASE_URL, _payload(), USER_HEADERS)).json()

        response = await execute_delete_request(f"{BASE_URL}/{created['id']}", USER_HEADERS)

        assert response.status_code == 204
        get_response = await execute_get_request(f"{BASE_URL}/{created['id']}", USER_HEADERS)
        assert get_response.status_code == 404

    @pytest.mark.anyio
    async def test_owned_by_another_user_returns_404(self):
        await _setup_user()
        await push_user2()
        created = (await execute_post_request(BASE_URL, _payload(), USER_HEADERS)).json()

        response = await execute_delete_request(f"{BASE_URL}/{created['id']}", USER2_HEADERS)

        assert response.status_code == 404

    @pytest.mark.anyio
    async def test_unknown_id_returns_404(self):
        await _setup_user()

        response = await execute_delete_request(f"{BASE_URL}/{uuid.uuid4()}", USER_HEADERS)

        assert response.status_code == 404

    @pytest.mark.anyio
    async def test_without_auth_returns_401(self):
        response = await execute_delete_request(f"{BASE_URL}/{uuid.uuid4()}")
        assert response.status_code == 401

import uuid

import pytest

from main import app
from src.enums.Roles import Roles
from src.utils.db import get_session
from tests.integration.endpoints.setup.game_setup import (
    get_ascension_requests,
    push_ascension_request,
    push_champion,
)
from tests.integration.endpoints.setup.user_setup import push_one_user, push_user2
from tests.utils.utils_client import (
    create_auth_headers,
    execute_get_request,
    execute_post_request,
    execute_request,
)
from tests.utils.utils_constant import USER2_ID, USER_ID
from tests.utils.utils_db import get_test_session

app.dependency_overrides[get_session] = get_test_session

ROUTE = "/ascension-requests"
USER_HEADERS = create_auth_headers(user_id=str(USER_ID), role=Roles.USER)
USER2_HEADERS = create_auth_headers(user_id=str(USER2_ID), role=Roles.USER)


async def _request(champion_id: uuid.UUID, headers: dict[str, str] = USER_HEADERS):
    return await execute_post_request(ROUTE, {"champion_id": str(champion_id)}, headers=headers)


class TestCreateAscensionRequest:
    @pytest.mark.asyncio
    async def test_new_request_is_204(self, session):
        await push_one_user()
        champ = await push_champion("Wolverine", "Mutant")

        response = await _request(champ.id)

        assert response.status_code == 204
        rows = await get_ascension_requests(session)
        assert [(r.champion_id, r.requester_user_id) for r in rows] == [(champ.id, USER_ID)]

    @pytest.mark.asyncio
    async def test_repeated_request_is_204_and_keeps_first_requester(self, session):
        await push_one_user()
        await push_user2()
        champ = await push_champion("Wolverine", "Mutant")
        await _request(champ.id)

        response = await _request(champ.id, headers=USER2_HEADERS)

        assert response.status_code == 204
        rows = await get_ascension_requests(session)
        assert [r.requester_user_id for r in rows] == [USER_ID]

    @pytest.mark.asyncio
    async def test_unknown_champion_is_404(self, session):
        await push_one_user()

        response = await _request(uuid.uuid4())

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_already_ascendable_champion_is_409(self, session):
        await push_one_user()
        champ = await push_champion("Hercules", "Cosmic", is_ascendable=True)

        response = await _request(champ.id)

        assert response.status_code == 409
        assert await get_ascension_requests(session) == []


class TestRequestedChampionIds:
    @pytest.mark.asyncio
    async def test_returns_requested_ids_only(self, session):
        await push_one_user()
        requested = await push_champion("Wolverine", "Mutant")
        await push_champion("Hercules", "Cosmic")
        await push_ascension_request(requested)

        response = await execute_get_request(f"{ROUTE}/champion-ids", headers=USER_HEADERS)

        assert response.status_code == 200
        assert response.json() == [str(requested.id)]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("method", "url"),
    [("GET", f"{ROUTE}/champion-ids"), ("POST", ROUTE)],
    ids=["champion_ids", "create"],
)
async def test_no_auth_is_401(session, method, url):
    response = await execute_request(method, url)

    assert response.status_code == 401

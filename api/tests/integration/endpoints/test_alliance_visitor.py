"""Integration tests for alliance visitor system."""
import uuid
import pytest

from main import app
from src.utils.db import get_session
from tests.integration.endpoints.setup.user_setup import get_generic_user
from tests.integration.endpoints.setup.game_setup import (
    push_game_account,
    push_alliance_with_owner,
    push_officer,
    push_visitor,
)
from tests.utils.utils_client import (
    create_auth_headers,
    execute_get_request,
    execute_post_request,
    execute_delete_request,
)
from tests.utils.utils_constant import (
    USER_ID,
    USER2_ID,
    USER2_LOGIN,
    USER2_EMAIL,
    DISCORD_ID_2,
    GAME_PSEUDO,
    GAME_PSEUDO_2,
    ALLIANCE_NAME,
    ALLIANCE_TAG,
)
from tests.utils.utils_db import get_test_session, load_objects

app.dependency_overrides[get_session] = get_test_session

HEADERS_USER1 = create_auth_headers(user_id=str(USER_ID))
HEADERS_USER2 = create_auth_headers(user_id=str(USER2_ID))
USER3_ID = uuid.uuid4()
HEADERS_USER3 = create_auth_headers(user_id=str(USER3_ID))

ENDPOINT = "/alliances"


async def _setup_users():
    u1 = get_generic_user(is_base_id=True)
    u2 = get_generic_user(login=USER2_LOGIN, email=USER2_EMAIL)
    u2.id = USER2_ID
    u2.discord_id = DISCORD_ID_2
    u3 = get_generic_user(login="user3", email="user3@test.com")
    u3.id = USER3_ID
    u3.discord_id = "discord_user3"
    await load_objects([u1, u2, u3])


class TestInviteVisitor:
    @pytest.mark.asyncio
    async def test_officer_can_invite_visitor(self):
        await _setup_users()
        alliance, owner_acc = await push_alliance_with_owner(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        visitor_acc = await push_game_account(user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)

        response = await execute_post_request(
            f"{ENDPOINT}/{alliance.id}/invitations",
            {"game_account_id": str(visitor_acc.id), "type": "visitor"},
            headers=HEADERS_USER1,
        )
        assert response.status_code == 201
        body = response.json()
        assert body["type"] == "visitor"
        assert body["status"] == "pending"

    @pytest.mark.asyncio
    async def test_cannot_invite_visitor_when_max_reached(self):
        await _setup_users()
        alliance, owner_acc = await push_alliance_with_owner(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        from src.models.AllianceVisitor import AllianceVisitor
        from src.models.GameAccount import GameAccount
        visitors = []
        for i in range(10):
            uid = uuid.uuid4()
            u = get_generic_user(login=f"v{i}", email=f"v{i}@test.com")
            u.id = uid
            u.discord_id = f"discord_visitor{i}"
            acc = GameAccount(user_id=uid, game_pseudo=f"visitor{i}")
            v = AllianceVisitor(alliance_id=alliance.id, game_account_id=acc.id)
            visitors.extend([u, acc, v])
        await load_objects(visitors)

        new_acc = await push_game_account(user_id=USER2_ID, game_pseudo="newvisitor")
        response = await execute_post_request(
            f"{ENDPOINT}/{alliance.id}/invitations",
            {"game_account_id": str(new_acc.id), "type": "visitor"},
            headers=HEADERS_USER1,
        )
        assert response.status_code == 409

    @pytest.mark.asyncio
    async def test_random_user_cannot_invite_visitor(self):
        await _setup_users()
        alliance, owner_acc = await push_alliance_with_owner(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        visitor_acc = await push_game_account(user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)
        outsider_acc = await push_game_account(user_id=USER3_ID, game_pseudo="outsider")

        response = await execute_post_request(
            f"{ENDPOINT}/{alliance.id}/invitations",
            {"game_account_id": str(visitor_acc.id), "type": "visitor"},
            headers=HEADERS_USER3,
        )
        assert response.status_code == 403


class TestAcceptVisitorInvitation:
    @pytest.mark.asyncio
    async def test_accept_visitor_invitation_creates_visitor_record(self):
        await _setup_users()
        alliance, owner_acc = await push_alliance_with_owner(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        visitor_acc = await push_game_account(user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)

        invite_resp = await execute_post_request(
            f"{ENDPOINT}/{alliance.id}/invitations",
            {"game_account_id": str(visitor_acc.id), "type": "visitor"},
            headers=HEADERS_USER1,
        )
        inv_id = invite_resp.json()["id"]

        accept_resp = await execute_post_request(
            f"{ENDPOINT}/invitations/{inv_id}/accept",
            {},
            headers=HEADERS_USER2,
        )
        assert accept_resp.status_code == 200
        assert accept_resp.json()["status"] == "accepted"

        visitors_resp = await execute_get_request(
            f"{ENDPOINT}/{alliance.id}/visitors",
            headers=HEADERS_USER1,
        )
        assert visitors_resp.status_code == 200
        visitor_ids = [v["game_account_id"] for v in visitors_resp.json()]
        assert str(visitor_acc.id) in visitor_ids

    @pytest.mark.asyncio
    async def test_visitor_game_account_alliance_id_unchanged(self):
        await _setup_users()
        alliance, owner_acc = await push_alliance_with_owner(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        visitor_acc = await push_game_account(user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)

        invite_resp = await execute_post_request(
            f"{ENDPOINT}/{alliance.id}/invitations",
            {"game_account_id": str(visitor_acc.id), "type": "visitor"},
            headers=HEADERS_USER1,
        )
        inv_id = invite_resp.json()["id"]
        await execute_post_request(f"{ENDPOINT}/invitations/{inv_id}/accept", {}, headers=HEADERS_USER2)

        from src.models.GameAccount import GameAccount as GA
        from sqlmodel import select
        async for session in get_test_session():
            result = await session.exec(select(GA).where(GA.id == visitor_acc.id))
            acc = result.first()
            assert acc.alliance_id is None


class TestVisitorPermissions:
    @pytest.mark.asyncio
    async def test_visitor_cannot_access_visitor_list(self):
        await _setup_users()
        alliance, owner_acc = await push_alliance_with_owner(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        visitor_acc = await push_visitor(alliance=alliance, user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)

        response = await execute_get_request(
            f"{ENDPOINT}/{alliance.id}/visitors",
            headers=HEADERS_USER2,
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_visitor_cannot_invite_members(self):
        await _setup_users()
        alliance, owner_acc = await push_alliance_with_owner(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        visitor_acc = await push_visitor(alliance=alliance, user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)
        outsider_acc = await push_game_account(user_id=USER3_ID, game_pseudo="outsider")

        response = await execute_post_request(
            f"{ENDPOINT}/{alliance.id}/invitations",
            {"game_account_id": str(outsider_acc.id), "type": "member"},
            headers=HEADERS_USER2,
        )
        assert response.status_code == 403


class TestKickVisitor:
    @pytest.mark.asyncio
    async def test_officer_can_kick_visitor(self):
        await _setup_users()
        alliance, owner_acc = await push_alliance_with_owner(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        visitor_acc = await push_visitor(alliance=alliance, user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)

        response = await execute_delete_request(
            f"{ENDPOINT}/{alliance.id}/visitors/{visitor_acc.id}",
            headers=HEADERS_USER1,
        )
        assert response.status_code == 204

        visitors_resp = await execute_get_request(f"{ENDPOINT}/{alliance.id}/visitors", headers=HEADERS_USER1)
        assert visitors_resp.json() == []

    @pytest.mark.asyncio
    async def test_visitor_can_leave(self):
        await _setup_users()
        alliance, owner_acc = await push_alliance_with_owner(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        visitor_acc = await push_visitor(alliance=alliance, user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)

        response = await execute_delete_request(
            f"{ENDPOINT}/{alliance.id}/visitors/me",
            headers=HEADERS_USER2,
        )
        assert response.status_code == 204


class TestVisitorConvertToMember:
    @pytest.mark.asyncio
    async def test_accepting_member_invitation_removes_visitor_record(self):
        await _setup_users()
        alliance, owner_acc = await push_alliance_with_owner(user_id=USER_ID, game_pseudo=GAME_PSEUDO)
        visitor_acc = await push_visitor(alliance=alliance, user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)

        invite_resp = await execute_post_request(
            f"{ENDPOINT}/{alliance.id}/invitations",
            {"game_account_id": str(visitor_acc.id), "type": "member"},
            headers=HEADERS_USER1,
        )
        assert invite_resp.status_code == 201
        inv_id = invite_resp.json()["id"]

        accept_resp = await execute_post_request(
            f"{ENDPOINT}/invitations/{inv_id}/accept",
            {},
            headers=HEADERS_USER2,
        )
        assert accept_resp.status_code == 200

        visitors_resp = await execute_get_request(f"{ENDPOINT}/{alliance.id}/visitors", headers=HEADERS_USER1)
        visitor_ids = [v["game_account_id"] for v in visitors_resp.json()]
        assert str(visitor_acc.id) not in visitor_ids

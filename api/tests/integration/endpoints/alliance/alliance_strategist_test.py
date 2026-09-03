"""Integration tests for the alliance strategist rank."""

import pytest
from fastapi import HTTPException
from sqlmodel import select

from main import app
from src.models.alliance.AllianceStrategist import AllianceStrategist
from src.services.alliance.AllianceService import AllianceService
from src.utils.db import get_session
from tests.integration.endpoints.setup.game_setup import (
    push_alliance_with_owner,
    push_game_account,
    push_member,
    push_officer,
    push_strategist,
)
from tests.integration.endpoints.setup.user_setup import get_generic_user
from tests.utils.utils_client import (
    create_auth_headers,
    execute_delete_request,
    execute_post_request,
)
from tests.utils.utils_constant import (
    DISCORD_ID_2,
    GAME_PSEUDO_2,
    GAME_PSEUDO_3,
    USER2_EMAIL,
    USER2_ID,
    USER2_LOGIN,
    USER_ID,
)
from tests.utils.utils_db import get_test_session, load_objects

app.dependency_overrides[get_session] = get_test_session

HEADERS_USER1 = create_auth_headers(user_id=str(USER_ID))
HEADERS_USER2 = create_auth_headers(user_id=str(USER2_ID))

ENDPOINT = "/alliances"


async def _setup_2_users():
    """Insert two standard test users."""
    u1 = get_generic_user(is_base_id=True)
    u2 = get_generic_user(login=USER2_LOGIN, email=USER2_EMAIL)
    u2.id = USER2_ID
    u2.discord_id = DISCORD_ID_2
    await load_objects([u1, u2])


class TestStrategistModel:
    @pytest.mark.asyncio
    async def test_push_strategist_creates_a_row(self, session):
        await _setup_2_users()
        alliance, _owner = await push_alliance_with_owner()
        member = await push_member(alliance, USER2_ID, GAME_PSEUDO_2)

        await push_strategist(alliance, member)

        result = await session.exec(
            select(AllianceStrategist).where(
                AllianceStrategist.alliance_id == alliance.id,
                AllianceStrategist.game_account_id == member.id,
            )
        )
        row = result.first()
        assert row is not None
        assert row.assigned_at is not None


class TestCanPlace:
    @pytest.mark.asyncio
    async def test_strategist_can_place(self, session):
        await _setup_2_users()
        alliance, _owner = await push_alliance_with_owner()
        member = await push_member(alliance, USER2_ID, GAME_PSEUDO_2)
        await push_strategist(alliance, member)

        assert await AllianceService.can_place(session, USER2_ID, alliance.id) is True

    @pytest.mark.asyncio
    async def test_owner_can_place(self, session):
        await _setup_2_users()
        alliance, _owner = await push_alliance_with_owner()

        assert await AllianceService.can_place(session, USER_ID, alliance.id) is True

    @pytest.mark.asyncio
    async def test_officer_can_place(self, session):
        await _setup_2_users()
        alliance, _owner = await push_alliance_with_owner()
        member = await push_member(alliance, USER2_ID, GAME_PSEUDO_2)
        await push_officer(alliance, member)

        assert await AllianceService.can_place(session, USER2_ID, alliance.id) is True

    @pytest.mark.asyncio
    async def test_plain_member_cannot_place(self, session):
        await _setup_2_users()
        alliance, _owner = await push_alliance_with_owner()
        await push_member(alliance, USER2_ID, GAME_PSEUDO_2)

        assert await AllianceService.can_place(session, USER2_ID, alliance.id) is False

    @pytest.mark.asyncio
    async def test_require_strategist_raises_403_for_plain_member(self, session):
        await _setup_2_users()
        alliance, _owner = await push_alliance_with_owner()
        await push_member(alliance, USER2_ID, GAME_PSEUDO_2)

        with pytest.raises(HTTPException) as exc:
            await AllianceService.require_strategist(session, alliance.id, USER2_ID)
        assert exc.value.status_code == 403

    @pytest.mark.asyncio
    async def test_require_strategist_account_returns_the_strategist_account(self, session):
        await _setup_2_users()
        alliance, _owner = await push_alliance_with_owner()
        member = await push_member(alliance, USER2_ID, GAME_PSEUDO_2)
        await push_strategist(alliance, member)

        account = await AllianceService.require_strategist_account(session, alliance.id, USER2_ID)
        assert account.id == member.id


class TestStrategistMutations:
    @pytest.mark.asyncio
    async def test_add_strategist_on_a_member(self, session):
        await _setup_2_users()
        alliance, _owner = await push_alliance_with_owner()
        member = await push_member(alliance, USER2_ID, GAME_PSEUDO_2)

        await AllianceService.add_strategist(session, alliance.id, member.id)

        assert await AllianceService.can_place(session, USER2_ID, alliance.id) is True

    @pytest.mark.asyncio
    async def test_add_strategist_twice_conflicts(self, session):
        await _setup_2_users()
        alliance, _owner = await push_alliance_with_owner()
        member = await push_member(alliance, USER2_ID, GAME_PSEUDO_2)
        await push_strategist(alliance, member)

        with pytest.raises(HTTPException) as exc:
            await AllianceService.add_strategist(session, alliance.id, member.id)
        assert exc.value.status_code == 409

    @pytest.mark.asyncio
    async def test_an_officer_cannot_also_be_strategist(self, session):
        await _setup_2_users()
        alliance, _owner = await push_alliance_with_owner()
        member = await push_member(alliance, USER2_ID, GAME_PSEUDO_2)
        await push_officer(alliance, member)

        with pytest.raises(HTTPException) as exc:
            await AllianceService.add_strategist(session, alliance.id, member.id)
        assert exc.value.status_code == 409

    @pytest.mark.asyncio
    async def test_a_non_member_cannot_become_strategist(self, session):
        await _setup_2_users()
        alliance, _owner = await push_alliance_with_owner()
        outsider = await push_game_account(user_id=USER2_ID, game_pseudo=GAME_PSEUDO_2)

        with pytest.raises(HTTPException) as exc:
            await AllianceService.add_strategist(session, alliance.id, outsider.id)
        assert exc.value.status_code == 400

    @pytest.mark.asyncio
    async def test_remove_strategist(self, session):
        await _setup_2_users()
        alliance, _owner = await push_alliance_with_owner()
        member = await push_member(alliance, USER2_ID, GAME_PSEUDO_2)
        await push_strategist(alliance, member)

        await AllianceService.remove_strategist(session, alliance.id, member.id)

        assert await AllianceService.can_place(session, USER2_ID, alliance.id) is False

    @pytest.mark.asyncio
    async def test_remove_strategist_on_a_plain_member_is_404(self, session):
        await _setup_2_users()
        alliance, _owner = await push_alliance_with_owner()
        member = await push_member(alliance, USER2_ID, GAME_PSEUDO_2)

        with pytest.raises(HTTPException) as exc:
            await AllianceService.remove_strategist(session, alliance.id, member.id)
        assert exc.value.status_code == 404

    @pytest.mark.asyncio
    async def test_promoting_a_strategist_to_officer_drops_the_strategist_row(self, session):
        await _setup_2_users()
        alliance, _owner = await push_alliance_with_owner()
        member = await push_member(alliance, USER2_ID, GAME_PSEUDO_2)
        await push_strategist(alliance, member)

        await AllianceService.add_officer(session, alliance.id, member.id)

        assert await AllianceService._get_strategist_ids(session, alliance.id) == set()

    @pytest.mark.asyncio
    async def test_demoting_an_officer_does_not_make_them_strategist(self, session):
        await _setup_2_users()
        alliance, _owner = await push_alliance_with_owner()
        member = await push_member(alliance, USER2_ID, GAME_PSEUDO_2)
        await push_officer(alliance, member)

        await AllianceService.remove_officer(session, alliance.id, member.id)

        assert await AllianceService._get_strategist_ids(session, alliance.id) == set()
        assert await AllianceService.can_place(session, USER2_ID, alliance.id) is False

    @pytest.mark.asyncio
    async def test_kicking_a_strategist_drops_the_row(self, session):
        await _setup_2_users()
        alliance, _owner = await push_alliance_with_owner()
        member = await push_member(alliance, USER2_ID, GAME_PSEUDO_2)
        await push_strategist(alliance, member)

        await AllianceService.remove_member(session, alliance.id, member.id)

        assert await AllianceService._get_strategist_ids(session, alliance.id) == set()


class TestStrategistEndpoints:
    @pytest.mark.asyncio
    async def test_owner_promotes_a_member(self):
        await _setup_2_users()
        alliance, _owner = await push_alliance_with_owner()
        member = await push_member(alliance, USER2_ID, GAME_PSEUDO_2)

        response = await execute_post_request(
            f"{ENDPOINT}/{alliance.id}/strategists",
            payload={"game_account_id": str(member.id)},
            headers=HEADERS_USER1,
        )

        assert response.status_code == 201
        row = next(m for m in response.json()["members"] if m["id"] == str(member.id))
        assert row["is_strategist"] is True

    @pytest.mark.asyncio
    async def test_officer_promotes_a_member(self):
        await _setup_2_users()
        alliance, _owner = await push_alliance_with_owner()
        officer_acc = await push_member(alliance, USER2_ID, GAME_PSEUDO_2)
        await push_officer(alliance, officer_acc)
        target = await push_game_account(user_id=USER2_ID, game_pseudo=GAME_PSEUDO_3)
        target.alliance_id = alliance.id
        await load_objects([target])

        response = await execute_post_request(
            f"{ENDPOINT}/{alliance.id}/strategists",
            payload={"game_account_id": str(target.id)},
            headers=HEADERS_USER2,
        )

        assert response.status_code == 201

    @pytest.mark.asyncio
    async def test_a_strategist_cannot_promote(self):
        await _setup_2_users()
        alliance, _owner = await push_alliance_with_owner()
        strategist_acc = await push_member(alliance, USER2_ID, GAME_PSEUDO_2)
        await push_strategist(alliance, strategist_acc)
        target = await push_game_account(user_id=USER2_ID, game_pseudo=GAME_PSEUDO_3)
        target.alliance_id = alliance.id
        await load_objects([target])

        response = await execute_post_request(
            f"{ENDPOINT}/{alliance.id}/strategists",
            payload={"game_account_id": str(target.id)},
            headers=HEADERS_USER2,
        )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_owner_demotes_a_strategist(self):
        await _setup_2_users()
        alliance, _owner = await push_alliance_with_owner()
        member = await push_member(alliance, USER2_ID, GAME_PSEUDO_2)
        await push_strategist(alliance, member)

        response = await execute_delete_request(
            f"{ENDPOINT}/{alliance.id}/strategists",
            headers=HEADERS_USER1,
            payload={"game_account_id": str(member.id)},
        )

        assert response.status_code == 200
        row = next(m for m in response.json()["members"] if m["id"] == str(member.id))
        assert row["is_strategist"] is False

    @pytest.mark.asyncio
    async def test_officer_demotes_a_strategist(self):
        """The intermediate rank's positive path: an officer, not just the owner,
        can revoke the strategist rank."""
        await _setup_2_users()
        alliance, _owner = await push_alliance_with_owner()
        officer_acc = await push_member(alliance, USER2_ID, GAME_PSEUDO_2)
        await push_officer(alliance, officer_acc)
        target = await push_game_account(user_id=USER2_ID, game_pseudo=GAME_PSEUDO_3)
        target.alliance_id = alliance.id
        await load_objects([target])
        await push_strategist(alliance, target)

        response = await execute_delete_request(
            f"{ENDPOINT}/{alliance.id}/strategists",
            headers=HEADERS_USER2,
            payload={"game_account_id": str(target.id)},
        )

        assert response.status_code == 200
        row = next(m for m in response.json()["members"] if m["id"] == str(target.id))
        assert row["is_strategist"] is False

    @pytest.mark.asyncio
    async def test_a_plain_member_cannot_promote(self):
        await _setup_2_users()
        alliance, _owner = await push_alliance_with_owner()
        await push_member(alliance, USER2_ID, GAME_PSEUDO_2)
        target = await push_game_account(user_id=USER2_ID, game_pseudo=GAME_PSEUDO_3)
        target.alliance_id = alliance.id
        await load_objects([target])

        response = await execute_post_request(
            f"{ENDPOINT}/{alliance.id}/strategists",
            payload={"game_account_id": str(target.id)},
            headers=HEADERS_USER2,
        )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_a_plain_member_cannot_demote(self):
        await _setup_2_users()
        alliance, _owner = await push_alliance_with_owner()
        member = await push_member(alliance, USER2_ID, GAME_PSEUDO_2)
        strategist_acc = await push_game_account(user_id=USER2_ID, game_pseudo=GAME_PSEUDO_3)
        strategist_acc.alliance_id = alliance.id
        await load_objects([strategist_acc])
        await push_strategist(alliance, strategist_acc)
        assert member.id != strategist_acc.id

        response = await execute_delete_request(
            f"{ENDPOINT}/{alliance.id}/strategists",
            headers=HEADERS_USER2,
            payload={"game_account_id": str(strategist_acc.id)},
        )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_cannot_promote_an_account_of_another_alliance(self):
        """Cross-alliance IDOR: the target must be a member of *this* alliance."""
        await _setup_2_users()
        alliance_a, _owner = await push_alliance_with_owner()
        _, owner_b = await push_alliance_with_owner(
            user_id=USER2_ID,
            game_pseudo=GAME_PSEUDO_2,
            alliance_name="OtherAlliance",
            alliance_tag="OTHR",
        )

        response = await execute_post_request(
            f"{ENDPOINT}/{alliance_a.id}/strategists",
            payload={"game_account_id": str(owner_b.id)},
            headers=HEADERS_USER1,
        )

        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_cannot_demote_a_strategist_of_another_alliance(self):
        """Cross-alliance IDOR: the strategist row is scoped to its alliance."""
        await _setup_2_users()
        alliance_a, _owner = await push_alliance_with_owner()
        alliance_b, _owner_b = await push_alliance_with_owner(
            user_id=USER2_ID,
            game_pseudo=GAME_PSEUDO_2,
            alliance_name="OtherAlliance",
            alliance_tag="OTHR",
        )
        strategist_b = await push_member(alliance_b, USER2_ID, GAME_PSEUDO_3)
        await push_strategist(alliance_b, strategist_b)

        response = await execute_delete_request(
            f"{ENDPOINT}/{alliance_a.id}/strategists",
            headers=HEADERS_USER1,
            payload={"game_account_id": str(strategist_b.id)},
        )

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_unauthenticated_promote_returns_401(self):
        await _setup_2_users()
        alliance, _owner = await push_alliance_with_owner()
        member = await push_member(alliance, USER2_ID, GAME_PSEUDO_2)

        response = await execute_post_request(
            f"{ENDPOINT}/{alliance.id}/strategists",
            payload={"game_account_id": str(member.id)},
        )

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_unauthenticated_demote_returns_401(self):
        await _setup_2_users()
        alliance, _owner = await push_alliance_with_owner()
        member = await push_member(alliance, USER2_ID, GAME_PSEUDO_2)
        await push_strategist(alliance, member)

        response = await execute_delete_request(
            f"{ENDPOINT}/{alliance.id}/strategists",
            payload={"game_account_id": str(member.id)},
        )

        assert response.status_code == 401

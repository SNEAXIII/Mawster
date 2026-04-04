"""Unit tests for AllianceInvitationService — isolated from the database."""
import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException

from src.enums.InvitationStatus import InvitationStatus
from src.services.AllianceInvitationService import AllianceInvitationService, MAX_MEMBERS_PER_ALLIANCE


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_game_account(ga_id=None, alliance_id=None):
    ga = MagicMock()
    ga.id = ga_id or uuid.uuid4()
    ga.alliance_id = alliance_id
    return ga


def _make_invitation(inv_id=None, status=InvitationStatus.PENDING, alliance_id=None, game_account_id=None):
    inv = MagicMock()
    inv.id = inv_id or uuid.uuid4()
    inv.status = status
    inv.alliance_id = alliance_id or uuid.uuid4()
    inv.game_account_id = game_account_id or uuid.uuid4()
    return inv


def _make_session(*, get_returns=None, exec_scalar=None, exec_all=None, exec_first=None):
    """Build an AsyncMock session with configurable return values."""
    session = AsyncMock()
    session.add = MagicMock()
    session.commit = AsyncMock()
    session.refresh = AsyncMock()
    session.delete = AsyncMock()

    if get_returns is not None:
        session.get = AsyncMock(return_value=get_returns)

    if exec_scalar is not None:
        exec_result = MagicMock()
        exec_result.one.return_value = exec_scalar
        exec_result.first.return_value = None
        exec_result.all.return_value = []
        session.exec = AsyncMock(return_value=exec_result)

    if exec_all is not None:
        exec_result = MagicMock()
        exec_result.all.return_value = exec_all
        exec_result.first.return_value = None
        session.exec = AsyncMock(return_value=exec_result)

    if exec_first is not None:
        exec_result = MagicMock()
        exec_result.first.return_value = exec_first
        exec_result.all.return_value = []
        session.exec = AsyncMock(return_value=exec_result)

    return session


# ── _get_user_account_ids ────────────────────────────────────────────────────


class TestGetUserAccountIds:
    @pytest.mark.asyncio
    async def test_returns_set_of_account_ids(self):
        ga1 = _make_game_account()
        ga2 = _make_game_account()
        session = _make_session(exec_all=[ga1, ga2])
        user_id = uuid.uuid4()

        result = await AllianceInvitationService._get_user_account_ids(session, user_id)

        assert result == {ga1.id, ga2.id}

    @pytest.mark.asyncio
    async def test_returns_empty_set_when_no_accounts(self):
        session = _make_session(exec_all=[])
        result = await AllianceInvitationService._get_user_account_ids(session, uuid.uuid4())
        assert result == set()


# ── create_invitation ─────────────────────────────────────────────────────────


class TestCreateInvitation:
    @pytest.mark.asyncio
    async def test_raises_404_when_game_account_not_found(self):
        session = AsyncMock()
        session.get = AsyncMock(return_value=None)
        alliance = MagicMock()
        alliance.id = uuid.uuid4()

        with pytest.raises(HTTPException) as exc:
            await AllianceInvitationService.create_invitation(
                session, alliance.id, uuid.uuid4(), uuid.uuid4(), alliance
            )
        assert exc.value.status_code == 404

    @pytest.mark.asyncio
    async def test_raises_409_when_already_in_alliance(self):
        ga = _make_game_account(alliance_id=uuid.uuid4())
        session = AsyncMock()
        session.get = AsyncMock(return_value=ga)
        alliance = MagicMock()
        alliance.id = uuid.uuid4()

        with pytest.raises(HTTPException) as exc:
            await AllianceInvitationService.create_invitation(
                session, alliance.id, ga.id, uuid.uuid4(), alliance
            )
        assert exc.value.status_code == 409
        assert "already in an alliance" in exc.value.detail

    @pytest.mark.asyncio
    async def test_raises_409_when_alliance_is_full(self):
        ga = _make_game_account(alliance_id=None)
        alliance_id = uuid.uuid4()
        alliance = MagicMock()
        alliance.id = alliance_id

        # session.get → game account; session.exec → member count at max
        session = AsyncMock()
        session.get = AsyncMock(return_value=ga)
        count_result = MagicMock()
        count_result.one.return_value = MAX_MEMBERS_PER_ALLIANCE
        count_result.first.return_value = None
        session.exec = AsyncMock(return_value=count_result)

        with pytest.raises(HTTPException) as exc:
            await AllianceInvitationService.create_invitation(
                session, alliance_id, ga.id, uuid.uuid4(), alliance
            )
        assert exc.value.status_code == 409
        assert "maximum reached" in exc.value.detail

    @pytest.mark.asyncio
    async def test_raises_409_when_pending_invitation_exists(self):
        ga = _make_game_account(alliance_id=None)
        alliance_id = uuid.uuid4()
        alliance = MagicMock()
        alliance.id = alliance_id

        session = AsyncMock()
        session.get = AsyncMock(return_value=ga)

        exec_results = [
            MagicMock(one=MagicMock(return_value=0), first=MagicMock(return_value=None), all=MagicMock(return_value=[])),  # count < max
            MagicMock(first=MagicMock(return_value=_make_invitation())),  # pending exists
        ]
        session.exec = AsyncMock(side_effect=exec_results)

        with pytest.raises(HTTPException) as exc:
            await AllianceInvitationService.create_invitation(
                session, alliance_id, ga.id, uuid.uuid4(), alliance
            )
        assert exc.value.status_code == 409
        assert "pending invitation" in exc.value.detail


# ── get_invitations_for_user ──────────────────────────────────────────────────


class TestGetInvitationsForUser:
    @pytest.mark.asyncio
    async def test_returns_empty_list_when_user_has_no_accounts(self):
        session = _make_session(exec_all=[])
        result = await AllianceInvitationService.get_invitations_for_user(session, uuid.uuid4())
        assert result == []

    @pytest.mark.asyncio
    async def test_returns_pending_invitations(self):
        ga = _make_game_account()
        inv = _make_invitation(game_account_id=ga.id)

        session = AsyncMock()
        # First exec → accounts; second exec → invitations
        account_result = MagicMock()
        account_result.all.return_value = [ga]
        invitation_result = MagicMock()
        invitation_result.all.return_value = [inv]
        session.exec = AsyncMock(side_effect=[account_result, invitation_result])

        result = await AllianceInvitationService.get_invitations_for_user(session, uuid.uuid4())
        assert result == [inv]


# ── accept_invitation ─────────────────────────────────────────────────────────


class TestAcceptInvitation:
    @pytest.mark.asyncio
    async def test_raises_404_when_invitation_not_found(self):
        session = AsyncMock()
        session.get = AsyncMock(return_value=None)

        with pytest.raises(HTTPException) as exc:
            await AllianceInvitationService.accept_invitation(session, uuid.uuid4(), uuid.uuid4())
        assert exc.value.status_code == 404

    @pytest.mark.asyncio
    async def test_raises_400_when_invitation_not_pending(self):
        inv = _make_invitation(status=InvitationStatus.ACCEPTED)
        session = AsyncMock()
        session.get = AsyncMock(return_value=inv)

        with pytest.raises(HTTPException) as exc:
            await AllianceInvitationService.accept_invitation(session, inv.id, uuid.uuid4())
        assert exc.value.status_code == 400

    @pytest.mark.asyncio
    async def test_raises_403_when_invitation_not_for_user(self):
        ga_id = uuid.uuid4()
        inv = _make_invitation(game_account_id=ga_id)
        other_ga = _make_game_account()  # different id
        session = AsyncMock()
        session.get = AsyncMock(return_value=inv)
        account_result = MagicMock()
        account_result.all.return_value = [other_ga]  # user owns other_ga, not ga_id
        session.exec = AsyncMock(return_value=account_result)

        with pytest.raises(HTTPException) as exc:
            await AllianceInvitationService.accept_invitation(session, inv.id, uuid.uuid4())
        assert exc.value.status_code == 403


# ── decline_invitation ────────────────────────────────────────────────────────


class TestDeclineInvitation:
    @pytest.mark.asyncio
    async def test_raises_404_when_invitation_not_found(self):
        session = AsyncMock()
        session.get = AsyncMock(return_value=None)

        with pytest.raises(HTTPException) as exc:
            await AllianceInvitationService.decline_invitation(session, uuid.uuid4(), uuid.uuid4())
        assert exc.value.status_code == 404

    @pytest.mark.asyncio
    async def test_raises_400_when_not_pending(self):
        inv = _make_invitation(status=InvitationStatus.DECLINED)
        session = AsyncMock()
        session.get = AsyncMock(return_value=inv)

        with pytest.raises(HTTPException) as exc:
            await AllianceInvitationService.decline_invitation(session, inv.id, uuid.uuid4())
        assert exc.value.status_code == 400

    @pytest.mark.asyncio
    async def test_raises_403_when_invitation_not_for_user(self):
        ga_id = uuid.uuid4()
        inv = _make_invitation(game_account_id=ga_id)
        other_ga = _make_game_account()
        session = AsyncMock()
        session.get = AsyncMock(return_value=inv)
        account_result = MagicMock()
        account_result.all.return_value = [other_ga]
        session.exec = AsyncMock(return_value=account_result)

        with pytest.raises(HTTPException) as exc:
            await AllianceInvitationService.decline_invitation(session, inv.id, uuid.uuid4())
        assert exc.value.status_code == 403


# ── cancel_invitation ─────────────────────────────────────────────────────────


class TestCancelInvitation:
    @pytest.mark.asyncio
    async def test_raises_404_when_invitation_not_found(self):
        session = AsyncMock()
        session.get = AsyncMock(return_value=None)
        alliance = MagicMock()
        alliance.id = uuid.uuid4()

        with pytest.raises(HTTPException) as exc:
            await AllianceInvitationService.cancel_invitation(session, uuid.uuid4(), uuid.uuid4(), alliance)
        assert exc.value.status_code == 404

    @pytest.mark.asyncio
    async def test_raises_400_when_not_pending(self):
        inv = _make_invitation(status=InvitationStatus.ACCEPTED)
        session = AsyncMock()
        session.get = AsyncMock(return_value=inv)
        alliance = MagicMock()
        alliance.id = uuid.uuid4()

        with pytest.raises(HTTPException) as exc:
            await AllianceInvitationService.cancel_invitation(session, inv.id, uuid.uuid4(), alliance)
        assert exc.value.status_code == 400

    @pytest.mark.asyncio
    async def test_raises_403_when_wrong_alliance(self):
        alliance_id = uuid.uuid4()
        inv = _make_invitation(alliance_id=uuid.uuid4())  # different alliance
        session = AsyncMock()
        session.get = AsyncMock(return_value=inv)
        alliance = MagicMock()
        alliance.id = alliance_id

        with pytest.raises(HTTPException) as exc:
            await AllianceInvitationService.cancel_invitation(session, inv.id, uuid.uuid4(), alliance)
        assert exc.value.status_code == 403

    @pytest.mark.asyncio
    async def test_deletes_invitation_on_success(self):
        alliance_id = uuid.uuid4()
        inv = _make_invitation(alliance_id=alliance_id)
        session = AsyncMock()
        session.get = AsyncMock(return_value=inv)
        session.delete = AsyncMock()
        session.commit = AsyncMock()
        alliance = MagicMock()
        alliance.id = alliance_id

        result = await AllianceInvitationService.cancel_invitation(session, inv.id, uuid.uuid4(), alliance)

        session.delete.assert_called_once_with(inv)
        session.commit.assert_called_once()
        assert result == inv

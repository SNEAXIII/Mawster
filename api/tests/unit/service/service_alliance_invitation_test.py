"""Unit tests for AllianceInvitationService."""
import uuid

import pytest
from fastapi import HTTPException

from src.enums.InvitationStatus import InvitationStatus
from src.models.Alliance import Alliance
from src.models.AllianceInvitation import AllianceInvitation
from src.models.GameAccount import GameAccount
from src.services.AllianceInvitationService import AllianceInvitationService, MAX_MEMBERS_PER_ALLIANCE
from tests.utils.utils_constant import USER_ID, GAME_PSEUDO, ALLIANCE_NAME, ALLIANCE_TAG


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _mock_session(mocker):
    session = mocker.AsyncMock()
    session.add = mocker.MagicMock()
    return session


def _make_account(user_id=USER_ID, pseudo=GAME_PSEUDO, alliance_id=None, account_id=None):
    return GameAccount(
        id=account_id or uuid.uuid4(),
        user_id=user_id,
        game_pseudo=pseudo,
        alliance_id=alliance_id,
    )


def _make_invitation(
    alliance_id=None,
    game_account_id=None,
    status=InvitationStatus.PENDING,
    inv_id=None,
):
    return AllianceInvitation(
        id=inv_id or uuid.uuid4(),
        alliance_id=alliance_id or uuid.uuid4(),
        game_account_id=game_account_id or uuid.uuid4(),
        invited_by_game_account_id=uuid.uuid4(),
        status=status,
    )


def _make_alliance(alliance_id=None, owner_id=None):
    return Alliance(
        id=alliance_id or uuid.uuid4(),
        name=ALLIANCE_NAME,
        tag=ALLIANCE_TAG,
        owner_id=owner_id or uuid.uuid4(),
    )


# =========================================================================
# create_invitation
# =========================================================================


class TestCreateInvitation:
    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "account_exists, already_in_alliance, member_count, has_pending, inviter_in_alliance, expected_status",
        [
            (True,  False, 0,                        False, True,  None),
            (False, False, 0,                        False, True,  404),
            (True,  True,  0,                        False, True,  409),
            (True,  False, MAX_MEMBERS_PER_ALLIANCE, False, True,  409),
            (True,  False, 0,                        True,  True,  409),
            (True,  False, 0,                        False, False, 403),
        ],
        ids=[
            "success",
            "account_not_found",
            "already_in_alliance",
            "alliance_full",
            "pending_already_exists",
            "inviter_not_in_alliance",
        ],
    )
    async def test_create_invitation(
        self,
        mocker,
        account_exists,
        already_in_alliance,
        member_count,
        has_pending,
        inviter_in_alliance,
        expected_status,
    ):
        session = _mock_session(mocker)
        alliance_id = uuid.uuid4()
        ga_id = uuid.uuid4()
        inviter_id = USER_ID
        inviter_acc_id = uuid.uuid4()

        invited_acc = (
            _make_account(
                account_id=ga_id,
                alliance_id=uuid.uuid4() if already_in_alliance else None,
            )
            if account_exists
            else None
        )
        inviter_acc = _make_account(
            user_id=inviter_id,
            account_id=inviter_acc_id,
            alliance_id=alliance_id if inviter_in_alliance else uuid.uuid4(),
        )

        get_map = {ga_id: invited_acc, inviter_acc_id: inviter_acc}
        session.get = mocker.AsyncMock(side_effect=lambda model, id: get_map.get(id))

        if account_exists and not already_in_alliance:
            count_mock = mocker.MagicMock()
            count_mock.one.return_value = member_count

            pending_mock = mocker.MagicMock()
            pending_mock.first.return_value = _make_invitation() if has_pending else None

            inviter_accounts_mock = mocker.MagicMock()
            inviter_accounts_mock.all.return_value = [inviter_acc]

            session.exec = mocker.AsyncMock(
                side_effect=[count_mock, pending_mock, inviter_accounts_mock]
            )

        alliance = _make_alliance(alliance_id=alliance_id)

        if expected_status is not None:
            with pytest.raises(HTTPException) as exc:
                await AllianceInvitationService.create_invitation(
                    session, alliance_id, ga_id, inviter_id, alliance
                )
            assert exc.value.status_code == expected_status
        else:
            result = await AllianceInvitationService.create_invitation(
                session, alliance_id, ga_id, inviter_id, alliance
            )
            assert result is not None
            assert result.game_account_id == ga_id


# =========================================================================
# get_invitations_for_user
# =========================================================================


class TestGetInvitationsForUser:
    @pytest.mark.asyncio
    async def test_user_with_no_accounts_returns_empty(self, mocker):
        session = _mock_session(mocker)
        accounts_mock = mocker.MagicMock()
        accounts_mock.all.return_value = []
        session.exec.return_value = accounts_mock

        result = await AllianceInvitationService.get_invitations_for_user(session, USER_ID)
        assert result == []

    @pytest.mark.asyncio
    async def test_returns_pending_invitations(self, mocker):
        session = _mock_session(mocker)
        acc = _make_account(user_id=USER_ID)
        inv = _make_invitation(game_account_id=acc.id)

        accounts_mock = mocker.MagicMock()
        accounts_mock.all.return_value = [acc]

        invitations_mock = mocker.MagicMock()
        invitations_mock.all.return_value = [inv]

        session.exec = mocker.AsyncMock(side_effect=[accounts_mock, invitations_mock])

        result = await AllianceInvitationService.get_invitations_for_user(session, USER_ID)
        assert len(result) == 1
        assert result[0].game_account_id == acc.id


# =========================================================================
# get_invitations_for_alliance
# =========================================================================


class TestGetInvitationsForAlliance:
    @pytest.mark.asyncio
    async def test_returns_pending_invitations(self, mocker):
        session = _mock_session(mocker)
        alliance_id = uuid.uuid4()
        inv = _make_invitation(alliance_id=alliance_id)

        invitations_mock = mocker.MagicMock()
        invitations_mock.all.return_value = [inv]
        session.exec.return_value = invitations_mock

        result = await AllianceInvitationService.get_invitations_for_alliance(session, alliance_id)
        assert len(result) == 1

    @pytest.mark.asyncio
    async def test_returns_empty_when_none(self, mocker):
        session = _mock_session(mocker)
        invitations_mock = mocker.MagicMock()
        invitations_mock.all.return_value = []
        session.exec.return_value = invitations_mock

        result = await AllianceInvitationService.get_invitations_for_alliance(
            session, uuid.uuid4()
        )
        assert result == []


# =========================================================================
# accept_invitation
# =========================================================================


class TestAcceptInvitation:
    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "inv_found, inv_pending, belongs_to_user, already_in_alliance, member_count, expected_status",
        [
            (True,  True,  True,  False, 0,                        None),
            (False, True,  True,  False, 0,                        404),
            (True,  False, True,  False, 0,                        400),
            (True,  True,  False, False, 0,                        403),
            (True,  True,  True,  True,  0,                        409),
            (True,  True,  True,  False, MAX_MEMBERS_PER_ALLIANCE, 409),
        ],
        ids=[
            "success",
            "invitation_not_found",
            "not_pending",
            "not_users_account",
            "already_in_alliance",
            "alliance_full",
        ],
    )
    async def test_accept_invitation(
        self,
        mocker,
        inv_found,
        inv_pending,
        belongs_to_user,
        already_in_alliance,
        member_count,
        expected_status,
    ):
        session = _mock_session(mocker)
        alliance_id = uuid.uuid4()
        inv_id = uuid.uuid4()
        ga_id = uuid.uuid4()

        user_acc = _make_account(user_id=USER_ID, account_id=ga_id, alliance_id=None)

        invitation = (
            _make_invitation(
                inv_id=inv_id,
                game_account_id=ga_id if belongs_to_user else uuid.uuid4(),
                alliance_id=alliance_id,
                status=InvitationStatus.PENDING if inv_pending else InvitationStatus.DECLINED,
            )
            if inv_found
            else None
        )

        game_account = _make_account(
            account_id=ga_id,
            alliance_id=uuid.uuid4() if already_in_alliance else None,
        )

        get_map = {inv_id: invitation, ga_id: game_account}
        session.get = mocker.AsyncMock(side_effect=lambda model, id: get_map.get(id))

        accounts_mock = mocker.MagicMock()
        accounts_mock.all.return_value = [user_acc]

        count_mock = mocker.MagicMock()
        count_mock.one.return_value = member_count

        other_pending_mock = mocker.MagicMock()
        other_pending_mock.all.return_value = []

        session.exec = mocker.AsyncMock(
            side_effect=[accounts_mock, count_mock, other_pending_mock]
        )

        if expected_status is not None:
            with pytest.raises(HTTPException) as exc:
                await AllianceInvitationService.accept_invitation(session, inv_id, USER_ID)
            assert exc.value.status_code == expected_status
        else:
            result = await AllianceInvitationService.accept_invitation(session, inv_id, USER_ID)
            assert result is not None
            assert result.status == InvitationStatus.ACCEPTED


# =========================================================================
# decline_invitation
# =========================================================================


class TestDeclineInvitation:
    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "inv_found, inv_pending, belongs_to_user, expected_status",
        [
            (True,  True,  True,  None),
            (False, True,  True,  404),
            (True,  False, True,  400),
            (True,  True,  False, 403),
        ],
        ids=["success", "not_found", "not_pending", "not_users_account"],
    )
    async def test_decline_invitation(
        self, mocker, inv_found, inv_pending, belongs_to_user, expected_status
    ):
        session = _mock_session(mocker)
        inv_id = uuid.uuid4()
        ga_id = uuid.uuid4()

        user_acc = _make_account(user_id=USER_ID, account_id=ga_id)

        invitation = (
            _make_invitation(
                inv_id=inv_id,
                game_account_id=ga_id if belongs_to_user else uuid.uuid4(),
                status=InvitationStatus.PENDING if inv_pending else InvitationStatus.DECLINED,
            )
            if inv_found
            else None
        )

        session.get = mocker.AsyncMock(return_value=invitation)

        accounts_mock = mocker.MagicMock()
        accounts_mock.all.return_value = [user_acc]
        session.exec.return_value = accounts_mock

        if expected_status is not None:
            with pytest.raises(HTTPException) as exc:
                await AllianceInvitationService.decline_invitation(session, inv_id, USER_ID)
            assert exc.value.status_code == expected_status
        else:
            result = await AllianceInvitationService.decline_invitation(session, inv_id, USER_ID)
            assert result.status == InvitationStatus.DECLINED


# =========================================================================
# cancel_invitation
# =========================================================================


class TestCancelInvitation:
    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "inv_found, inv_pending, same_alliance, expected_status",
        [
            (True,  True,  True,  None),
            (False, True,  True,  404),
            (True,  False, True,  400),
            (True,  True,  False, 403),
        ],
        ids=["success", "not_found", "not_pending", "different_alliance"],
    )
    async def test_cancel_invitation(
        self, mocker, inv_found, inv_pending, same_alliance, expected_status
    ):
        session = _mock_session(mocker)
        alliance_id = uuid.uuid4()
        inv_id = uuid.uuid4()

        invitation = (
            _make_invitation(
                inv_id=inv_id,
                alliance_id=alliance_id if same_alliance else uuid.uuid4(),
                status=InvitationStatus.PENDING if inv_pending else InvitationStatus.DECLINED,
            )
            if inv_found
            else None
        )

        session.get = mocker.AsyncMock(return_value=invitation)
        alliance = _make_alliance(alliance_id=alliance_id)

        if expected_status is not None:
            with pytest.raises(HTTPException) as exc:
                await AllianceInvitationService.cancel_invitation(
                    session, inv_id, USER_ID, alliance
                )
            assert exc.value.status_code == expected_status
        else:
            result = await AllianceInvitationService.cancel_invitation(
                session, inv_id, USER_ID, alliance
            )
            session.delete.assert_called_once_with(invitation)
            assert result is invitation

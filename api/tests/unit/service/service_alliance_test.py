"""Unit tests for AllianceService — access control and business logic."""
import uuid

import pytest
from fastapi import HTTPException

from src.models.Alliance import Alliance
from src.models.AllianceOfficer import AllianceOfficer
from src.models.GameAccount import GameAccount
from src.services.AllianceService import AllianceService, MAX_MEMBERS_PER_GROUP, MAX_MEMBERS_PER_ALLIANCE
from tests.utils.utils_constant import (
    USER_ID,
    USER2_ID,
    GAME_PSEUDO,
    GAME_PSEUDO_2,
    ALLIANCE_NAME,
    ALLIANCE_TAG,
)


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


def _make_alliance(owner_id, alliance_id=None, members=None, officers=None):
    a = Alliance(
        id=alliance_id or uuid.uuid4(),
        name=ALLIANCE_NAME,
        tag=ALLIANCE_TAG,
        owner_id=owner_id,
    )
    # Manually set relationships for unit tests
    a.members = members or []
    a.officers = officers or []
    return a


def _make_officer(alliance_id, game_account_id):
    return AllianceOfficer(
        id=uuid.uuid4(),
        alliance_id=alliance_id,
        game_account_id=game_account_id,
    )


# =========================================================================
# _assert_is_owner_or_officer
# =========================================================================


class TestAssertIsOwnerOrOfficer:
    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "is_owner, is_officer, should_pass",
        [
            (True, False, True),
            (False, True, True),
            (False, False, False),
        ],
        ids=["owner_passes", "officer_passes", "regular_denied"],
    )
    async def test_access_check(self, mocker, is_owner, is_officer, should_pass):
        session = _mock_session(mocker)
        owner_acc = _make_account(user_id=USER_ID)
        officer_acc = _make_account(user_id=USER2_ID, pseudo=GAME_PSEUDO_2)
        alliance = _make_alliance(
            owner_id=owner_acc.id,
            officers=[_make_officer(uuid.uuid4(), officer_acc.id)] if is_officer or not is_owner else [],
        )

        if is_owner:
            caller_id = USER_ID
            caller_accounts = [owner_acc]
        elif is_officer:
            caller_id = USER2_ID
            caller_accounts = [officer_acc]
        else:
            caller_id = uuid.uuid4()
            caller_accounts = [_make_account(user_id=caller_id, pseudo="outsider")]

        result_mock = mocker.MagicMock()
        result_mock.all.return_value = caller_accounts
        session.exec.return_value = result_mock

        if should_pass:
            await AllianceService._assert_is_owner_or_officer(session, alliance, caller_id)
        else:
            with pytest.raises(HTTPException) as exc:
                await AllianceService._assert_is_owner_or_officer(session, alliance, caller_id)
            assert exc.value.status_code == 403


# =========================================================================
# _assert_is_owner
# =========================================================================


class TestAssertIsOwner:
    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "is_owner, should_pass",
        [(True, True), (False, False)],
        ids=["owner_passes", "non_owner_denied"],
    )
    async def test_owner_check(self, mocker, is_owner, should_pass):
        session = _mock_session(mocker)
        owner_acc = _make_account(user_id=USER_ID)
        alliance = _make_alliance(owner_id=owner_acc.id)

        caller_id = USER_ID if is_owner else uuid.uuid4()
        caller_accounts = [owner_acc] if is_owner else [_make_account(user_id=caller_id)]

        result_mock = mocker.MagicMock()
        result_mock.all.return_value = caller_accounts
        session.exec.return_value = result_mock

        if should_pass:
            await AllianceService._assert_is_owner(session, alliance, caller_id)
        else:
            with pytest.raises(HTTPException) as exc:
                await AllianceService._assert_is_owner(session, alliance, caller_id)
            assert exc.value.status_code == 403


# =========================================================================
# _assert_can_remove_member (new access control)
# =========================================================================


class TestAssertCanRemoveMember:
    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "caller_role, target_role, should_pass, expected_detail_fragment",
        [
            ("owner", "regular", True, None),
            ("owner", "officer", True, None),
            ("officer", "regular", True, None),
            ("officer", "officer", False, "officer cannot remove another officer"),
            ("regular", "regular", False, "Only the alliance owner or an officer"),
        ],
        ids=[
            "owner_removes_regular",
            "owner_removes_officer",
            "officer_removes_regular",
            "officer_cannot_remove_officer",
            "regular_cannot_remove",
        ],
    )
    async def test_remove_member_access(
        self, mocker, caller_role, target_role, should_pass, expected_detail_fragment
    ):
        session = _mock_session(mocker)

        owner_acc = _make_account(user_id=USER_ID, pseudo="owner")
        officer_acc = _make_account(user_id=USER2_ID, pseudo="officer1")
        officer2_acc = _make_account(user_id=uuid.uuid4(), pseudo="officer2")
        regular_acc = _make_account(user_id=uuid.uuid4(), pseudo="regular")

        alliance_id = uuid.uuid4()
        officers = [
            _make_officer(alliance_id, officer_acc.id),
            _make_officer(alliance_id, officer2_acc.id),
        ]
        alliance = _make_alliance(
            owner_id=owner_acc.id,
            alliance_id=alliance_id,
            officers=officers,
        )

        # Determine caller
        if caller_role == "owner":
            caller_id = USER_ID
            caller_accounts = [owner_acc]
        elif caller_role == "officer":
            caller_id = USER2_ID
            caller_accounts = [officer_acc]
        else:
            caller_id = uuid.uuid4()
            caller_accounts = [_make_account(user_id=caller_id)]

        # Determine target
        if target_role == "officer":
            target_id = officer2_acc.id
        else:
            target_id = regular_acc.id

        result_mock = mocker.MagicMock()
        result_mock.all.return_value = caller_accounts
        session.exec.return_value = result_mock

        if should_pass:
            await AllianceService._assert_can_remove_member(
                session, alliance, caller_id, target_id
            )
        else:
            with pytest.raises(HTTPException) as exc:
                await AllianceService._assert_can_remove_member(
                    session, alliance, caller_id, target_id
                )
            assert exc.value.status_code == 403
            assert expected_detail_fragment.lower() in exc.value.detail.lower()


# =========================================================================
# create_alliance
# =========================================================================


class TestCreateAlliance:
    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "owner_exists, owner_belongs_to_user, already_in_alliance, expected_status",
        [
            (True, True, False, None),    # success
            (False, False, False, 404),   # owner not found
            (True, False, False, 403),    # not your account
            (True, True, True, 409),      # already in alliance
        ],
        ids=["success", "owner_not_found", "not_your_account", "already_in_alliance"],
    )
    async def test_create_alliance_variants(
        self, mocker, owner_exists, owner_belongs_to_user, already_in_alliance, expected_status
    ):
        session = _mock_session(mocker)
        owner_id = uuid.uuid4()

        if owner_exists:
            owner = _make_account(
                user_id=USER_ID if owner_belongs_to_user else uuid.uuid4(),
                account_id=owner_id,
                alliance_id=uuid.uuid4() if already_in_alliance else None,
            )
        else:
            owner = None

        session.get.return_value = owner

        # For success path, mock flush + _load_alliance_with_relations
        if expected_status is None:
            session.flush = mocker.AsyncMock()
            mocker.patch.object(
                AllianceService,
                "_load_alliance_with_relations",
                return_value=_make_alliance(owner_id=owner_id),
            )

        if expected_status is not None:
            with pytest.raises(HTTPException) as exc:
                await AllianceService.create_alliance(
                    session, ALLIANCE_NAME, ALLIANCE_TAG, owner_id, USER_ID
                )
            assert exc.value.status_code == expected_status
        else:
            result = await AllianceService.create_alliance(
                session, ALLIANCE_NAME, ALLIANCE_TAG, owner_id, USER_ID
            )
            assert result is not None


# =========================================================================
# add_member
# =========================================================================


class TestAddMember:
    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "account_exists, already_in_alliance, current_member_count, expected_status",
        [
            (True, False, 0, None),
            (False, False, 0, 404),
            (True, True, 0, 409),
            (True, False, MAX_MEMBERS_PER_ALLIANCE, 409),
        ],
        ids=["success", "account_not_found", "already_in_alliance", "alliance_full"],
    )
    async def test_add_member(self, mocker, account_exists, already_in_alliance, current_member_count, expected_status):
        session = _mock_session(mocker)
        alliance_id = uuid.uuid4()
        ga_id = uuid.uuid4()

        if account_exists:
            acc = _make_account(
                account_id=ga_id,
                alliance_id=uuid.uuid4() if already_in_alliance else None,
            )
        else:
            acc = None

        session.get.return_value = acc

        # Mock the member count query (used after account checks pass)
        if account_exists and not already_in_alliance:
            count_mock = mocker.MagicMock()
            count_mock.one.return_value = current_member_count
            session.exec.return_value = count_mock

        if expected_status is None:
            mocker.patch.object(
                AllianceService,
                "_load_alliance_with_relations",
                return_value=_make_alliance(owner_id=uuid.uuid4(), alliance_id=alliance_id),
            )

        if expected_status is not None:
            with pytest.raises(HTTPException) as exc:
                await AllianceService.add_member(session, alliance_id, ga_id)
            assert exc.value.status_code == expected_status
        else:
            result = await AllianceService.add_member(session, alliance_id, ga_id)
            assert result is not None


# =========================================================================
# remove_member
# =========================================================================


class TestRemoveMember:
    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "alliance_exists, is_owner, member_found, expected_status",
        [
            (True, False, True, None),     # success
            (False, False, False, 404),    # alliance not found
            (True, True, True, 400),       # can't remove owner
            (True, False, False, 404),     # member not in alliance
        ],
        ids=["success", "alliance_not_found", "cannot_remove_owner", "member_not_found"],
    )
    async def test_remove_member(
        self, mocker, alliance_exists, is_owner, member_found, expected_status
    ):
        session = _mock_session(mocker)
        alliance_id = uuid.uuid4()
        ga_id = uuid.uuid4()
        owner_id = ga_id if is_owner else uuid.uuid4()

        if alliance_exists:
            alliance = _make_alliance(owner_id=owner_id, alliance_id=alliance_id)
        else:
            alliance = None

        mocker.patch.object(
            AllianceService,
            "_load_alliance_with_relations",
            return_value=alliance,
        )

        if member_found and alliance_exists and not is_owner:
            member = _make_account(account_id=ga_id, alliance_id=alliance_id)
            session.get.return_value = member
            # Mock the officer check — no officer row
            officer_result = mocker.MagicMock()
            officer_result.first.return_value = None
            session.exec.return_value = officer_result

        elif alliance_exists and not is_owner:
            session.get.return_value = None

        if expected_status is not None:
            with pytest.raises(HTTPException) as exc:
                await AllianceService.remove_member(session, alliance_id, ga_id)
            assert exc.value.status_code == expected_status
        else:
            result = await AllianceService.remove_member(session, alliance_id, ga_id)
            assert result is not None


# =========================================================================
# add_adjoint / remove_adjoint
# =========================================================================


class TestAddAdjoint:
    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "account_exists, is_member, already_officer, expected_status",
        [
            (True, True, False, None),
            (False, False, False, 404),
            (True, False, False, 400),
            (True, True, True, 409),
        ],
        ids=["success", "not_found", "not_member", "already_officer"],
    )
    async def test_add_adjoint(
        self, mocker, account_exists, is_member, already_officer, expected_status
    ):
        session = _mock_session(mocker)
        alliance_id = uuid.uuid4()
        ga_id = uuid.uuid4()

        if account_exists:
            acc = _make_account(
                account_id=ga_id,
                alliance_id=alliance_id if is_member else uuid.uuid4(),
            )
        else:
            acc = None

        session.get.return_value = acc

        if is_member and account_exists:
            existing_mock = mocker.MagicMock()
            existing_mock.first.return_value = (
                _make_officer(alliance_id, ga_id) if already_officer else None
            )
            session.exec.return_value = existing_mock

            if not already_officer:
                mocker.patch.object(
                    AllianceService,
                    "_load_alliance_with_relations",
                    return_value=_make_alliance(owner_id=uuid.uuid4(), alliance_id=alliance_id),
                )

        if expected_status is not None:
            with pytest.raises(HTTPException) as exc:
                await AllianceService.add_adjoint(session, alliance_id, ga_id)
            assert exc.value.status_code == expected_status
        else:
            result = await AllianceService.add_adjoint(session, alliance_id, ga_id)
            assert result is not None


class TestRemoveAdjoint:
    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "officer_found, expected_status",
        [(True, None), (False, 404)],
        ids=["success", "not_found"],
    )
    async def test_remove_adjoint(self, mocker, officer_found, expected_status):
        session = _mock_session(mocker)
        alliance_id = uuid.uuid4()
        ga_id = uuid.uuid4()

        result_mock = mocker.MagicMock()
        result_mock.first.return_value = (
            _make_officer(alliance_id, ga_id) if officer_found else None
        )
        session.exec.return_value = result_mock

        if officer_found:
            mocker.patch.object(
                AllianceService,
                "_load_alliance_with_relations",
                return_value=_make_alliance(owner_id=uuid.uuid4(), alliance_id=alliance_id),
            )

        if expected_status is not None:
            with pytest.raises(HTTPException) as exc:
                await AllianceService.remove_adjoint(session, alliance_id, ga_id)
            assert exc.value.status_code == expected_status
        else:
            result = await AllianceService.remove_adjoint(session, alliance_id, ga_id)
            assert result is not None


# =========================================================================
# set_member_group
# =========================================================================


class TestSetMemberGroup:
    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "member_found, group, current_count, expected_status",
        [
            (True, 1, 0, None),        # success
            (True, None, 0, None),     # remove from group
            (False, 1, 0, 404),        # not a member
            (True, 5, 0, 400),         # invalid group number
            (True, 1, MAX_MEMBERS_PER_GROUP, 409),  # group full
        ],
        ids=["success", "remove_group", "not_member", "invalid_group", "group_full"],
    )
    async def test_set_member_group(
        self, mocker, member_found, group, current_count, expected_status
    ):
        session = _mock_session(mocker)
        alliance_id = uuid.uuid4()
        ga_id = uuid.uuid4()

        if member_found:
            acc = _make_account(account_id=ga_id, alliance_id=alliance_id)
        else:
            acc = None

        session.get.return_value = acc

        if member_found and group is not None and group in (1, 2, 3):
            # Mock count query
            count_mock = mocker.MagicMock()
            count_mock.one.return_value = current_count
            session.exec.return_value = count_mock

        if expected_status is None:
            mocker.patch.object(
                AllianceService,
                "_load_alliance_with_relations",
                return_value=_make_alliance(owner_id=uuid.uuid4(), alliance_id=alliance_id),
            )

        if expected_status is not None:
            with pytest.raises(HTTPException) as exc:
                await AllianceService.set_member_group(session, alliance_id, ga_id, group)
            assert exc.value.status_code == expected_status
        else:
            result = await AllianceService.set_member_group(session, alliance_id, ga_id, group)
            assert result is not None


# =========================================================================
# Eligibility queries (no mocking needed — pure filters)
# =========================================================================


class TestGetEligibleOwners:
    @pytest.mark.asyncio
    async def test_returns_free_accounts(self, mocker):
        session = _mock_session(mocker)
        free = _make_account(alliance_id=None)
        result_mock = mocker.MagicMock()
        result_mock.all.return_value = [free]
        session.exec.return_value = result_mock

        result = await AllianceService.get_eligible_owners(session, USER_ID)
        assert len(result) == 1


class TestGetMyRoles:
    """Tests for AllianceService.get_my_roles — returns role map per alliance."""

    @pytest.mark.asyncio
    async def test_no_accounts(self, mocker):
        """User with no game accounts gets empty roles and empty account list."""
        session = _mock_session(mocker)
        result_mock = mocker.MagicMock()
        result_mock.all.return_value = []
        session.exec.return_value = result_mock

        result = await AllianceService.get_my_roles(session, USER_ID)
        assert result["roles"] == {}
        assert result["my_account_ids"] == []

    @pytest.mark.asyncio
    async def test_accounts_not_in_alliance(self, mocker):
        """User with game accounts but none in an alliance → empty roles, non-empty account list."""
        session = _mock_session(mocker)
        acc = _make_account(user_id=USER_ID, alliance_id=None)

        result_mock = mocker.MagicMock()
        result_mock.all.return_value = [acc]
        session.exec.return_value = result_mock

        result = await AllianceService.get_my_roles(session, USER_ID)
        assert result["roles"] == {}
        assert str(acc.id) in result["my_account_ids"]

    @pytest.mark.asyncio
    async def test_owner_role(self, mocker):
        """User who owns an alliance → is_owner=True, can_manage=True."""
        session = _mock_session(mocker)
        alliance_id = uuid.uuid4()
        acc = _make_account(user_id=USER_ID, alliance_id=alliance_id)

        alliance = _make_alliance(owner_id=acc.id, alliance_id=alliance_id, officers=[])

        # First exec returns user accounts, second returns alliances
        accounts_result = mocker.MagicMock()
        accounts_result.all.return_value = [acc]
        alliances_result = mocker.MagicMock()
        alliances_result.all.return_value = [alliance]
        session.exec.side_effect = [accounts_result, alliances_result]

        result = await AllianceService.get_my_roles(session, USER_ID)
        role = result["roles"][str(alliance_id)]
        assert role["is_owner"] is True
        assert role["is_officer"] is False
        assert role["can_manage"] is True

    @pytest.mark.asyncio
    async def test_officer_role(self, mocker):
        """User who is an officer → is_officer=True, can_manage=True, is_owner=False."""
        session = _mock_session(mocker)
        alliance_id = uuid.uuid4()
        acc = _make_account(user_id=USER_ID, alliance_id=alliance_id)
        owner_acc = _make_account(user_id=USER2_ID, alliance_id=alliance_id)

        officer = _make_officer(alliance_id, acc.id)
        alliance = _make_alliance(
            owner_id=owner_acc.id, alliance_id=alliance_id, officers=[officer]
        )

        accounts_result = mocker.MagicMock()
        accounts_result.all.return_value = [acc]
        alliances_result = mocker.MagicMock()
        alliances_result.all.return_value = [alliance]
        session.exec.side_effect = [accounts_result, alliances_result]

        result = await AllianceService.get_my_roles(session, USER_ID)
        role = result["roles"][str(alliance_id)]
        assert role["is_owner"] is False
        assert role["is_officer"] is True
        assert role["can_manage"] is True

    @pytest.mark.asyncio
    async def test_regular_member_role(self, mocker):
        """Regular member → is_owner=False, is_officer=False, can_manage=False."""
        session = _mock_session(mocker)
        alliance_id = uuid.uuid4()
        acc = _make_account(user_id=USER_ID, alliance_id=alliance_id)
        owner_acc = _make_account(user_id=USER2_ID, alliance_id=alliance_id)

        alliance = _make_alliance(
            owner_id=owner_acc.id, alliance_id=alliance_id, officers=[]
        )

        accounts_result = mocker.MagicMock()
        accounts_result.all.return_value = [acc]
        alliances_result = mocker.MagicMock()
        alliances_result.all.return_value = [alliance]
        session.exec.side_effect = [accounts_result, alliances_result]

        result = await AllianceService.get_my_roles(session, USER_ID)
        role = result["roles"][str(alliance_id)]
        assert role["is_owner"] is False
        assert role["is_officer"] is False
        assert role["can_manage"] is False

    @pytest.mark.asyncio
    async def test_multiple_alliances(self, mocker):
        """User in two alliances — owner of one, officer of another."""
        session = _mock_session(mocker)
        alliance1_id = uuid.uuid4()
        alliance2_id = uuid.uuid4()
        acc1 = _make_account(user_id=USER_ID, alliance_id=alliance1_id)
        acc2 = _make_account(user_id=USER_ID, pseudo=GAME_PSEUDO_2, alliance_id=alliance2_id)
        other_owner = _make_account(user_id=USER2_ID, alliance_id=alliance2_id)

        officer_entry = _make_officer(alliance2_id, acc2.id)
        alliance1 = _make_alliance(owner_id=acc1.id, alliance_id=alliance1_id, officers=[])
        alliance2 = _make_alliance(
            owner_id=other_owner.id, alliance_id=alliance2_id, officers=[officer_entry]
        )

        accounts_result = mocker.MagicMock()
        accounts_result.all.return_value = [acc1, acc2]
        alliances_result = mocker.MagicMock()
        alliances_result.all.return_value = [alliance1, alliance2]
        session.exec.side_effect = [accounts_result, alliances_result]

        result = await AllianceService.get_my_roles(session, USER_ID)
        assert len(result["roles"]) == 2
        assert result["roles"][str(alliance1_id)]["is_owner"] is True
        assert result["roles"][str(alliance2_id)]["is_officer"] is True
        assert len(result["my_account_ids"]) == 2


class TestGetEligibleOfficers:
    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "alliance_exists",
        [True, False],
        ids=["found", "not_found"],
    )
    async def test_eligible_officers(self, mocker, alliance_exists):
        session = _mock_session(mocker)
        alliance_id = uuid.uuid4()
        owner_id = uuid.uuid4()

        if alliance_exists:
            member = _make_account(pseudo="member1", alliance_id=alliance_id)
            alliance = _make_alliance(
                owner_id=owner_id,
                alliance_id=alliance_id,
                members=[member],
                officers=[],
            )
        else:
            alliance = None

        mocker.patch.object(
            AllianceService,
            "_load_alliance_with_relations",
            return_value=alliance,
        )

        if alliance_exists:
            result = await AllianceService.get_eligible_officers(session, alliance_id)
            assert len(result) == 1
        else:
            with pytest.raises(HTTPException) as exc:
                await AllianceService.get_eligible_officers(session, alliance_id)
            assert exc.value.status_code == 404

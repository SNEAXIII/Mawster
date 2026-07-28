import uuid
from datetime import UTC, datetime

import pytest

from src.dto.auth.dto_utilisateurs import UserAdminViewSingleUser
from src.enums.Roles import Roles
from src.Messages.user_messages import (
    LOGIN_ALREADY_TAKEN,
    TARGET_USER_DOESNT_EXISTS,
    TARGET_USER_IS_ADMIN,
    TARGET_USER_IS_ALREADY_DELETED,
    TARGET_USER_IS_ALREADY_DISABLED,
    TARGET_USER_IS_ALREADY_ENABLED,
    TARGET_USER_IS_DELETED,
    TARGET_USER_IS_NOT_ADMIN,
    TARGET_USER_IS_SUPER_ADMIN,
    USER_DOESNT_EXISTS,
    USER_IS_DELETED,
    USER_IS_DISABLED,
    UserAdminError,
    UserLoginError,
)
from src.models import User
from src.models.Base import utcnow
from src.services.account.UserService import UserService
from src.services.admin.UserAdminService import UserAdminService
from tests.unit.service.mocks.session_mock import session_mock
from tests.unit.service.mocks.users_mock import (
    get_total_users_mock,
    get_user_by_login_mock,
    get_user_mock,
    get_users_paginated_mock,
)
from tests.utils.utils_constant import (
    DISCORD_ID,
    EMAIL,
    LOGIN,
    PAGE,
    ROLE,
    SIZE,
    STATUS,
    USER_ID,
)


@pytest.mark.asyncio
async def test_get_user(mocker):
    # Arrange
    mock_session = session_mock(mocker)

    # Act
    await UserService.get_user(mock_session, USER_ID)

    # Assert
    mock_session.get.assert_called_once_with(User, USER_ID)


@pytest.mark.asyncio
async def test_get_user_by_login(mocker):
    # Arrange
    mock_session = session_mock(mocker)

    # Act
    await UserService.get_user_by_login(mock_session, LOGIN)

    # Assert
    mock_session.exec.assert_called_once()
    mock_session.exec.return_value.first.assert_called_once_with()


@pytest.mark.asyncio
async def test_get_users_paginated(mocker):
    # Arrange
    mock_session = session_mock(mocker)

    # Act
    await UserAdminService.get_users_paginated(mock_session, PAGE, SIZE, STATUS, ROLE)

    # Assert
    mock_session.exec.assert_called_once()
    mock_session.exec.return_value.all.assert_called_once_with()


@pytest.mark.asyncio
async def test_get_total_users(mocker):
    # Arrange
    mock_session = session_mock(mocker)

    # Act
    await UserAdminService.get_total_users(mock_session, STATUS, ROLE)

    # Assert
    mock_session.exec.assert_called_once()
    mock_session.exec.return_value.one.assert_called_once_with()


@pytest.mark.asyncio
async def test_get_users_with_pagination_role_search(mocker):
    # Arrange
    total_user_result = 45
    user_list_for_mock = [User(id=USER_ID, login=LOGIN, discord_id=DISCORD_ID) for _ in range(10)]
    expected_list_result = [
        UserAdminViewSingleUser.model_validate(user.model_dump()) for user in user_list_for_mock
    ]
    mock_session = session_mock(mocker)
    mock_get_users_paginated = get_users_paginated_mock(mocker, user_list_for_mock)
    mock_get_total_users = get_total_users_mock(mocker, return_value=total_user_result)
    STATUS = "status"
    ROLE = Roles.USER
    SEARCH = "search"

    # Act
    result = await UserAdminService.get_users_with_pagination_role_search(
        mock_session, PAGE, SIZE, STATUS, ROLE, SEARCH
    )

    # Assert
    assert result.users == expected_list_result
    assert result.total_users == total_user_result
    assert result.total_pages == 5
    assert result.current_page == PAGE
    mock_get_total_users.assert_called_once_with(mock_session, STATUS, ROLE, SEARCH)
    mock_get_users_paginated.assert_called_once_with(mock_session, PAGE, SIZE, STATUS, ROLE, SEARCH)


@pytest.mark.asyncio
async def test_get_user_by_login_with_validity_check_success(mocker):
    # Arrange
    fake_user = User(login=LOGIN)
    mock_session = session_mock(mocker)
    mock_user_by_login = get_user_by_login_mock(mocker, fake_user)

    # Act
    result = await UserService.get_user_by_login_with_validity_check(mock_session, LOGIN)

    # Assert
    assert fake_user == result
    mock_user_by_login.assert_called_once_with(mock_session, LOGIN)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "fake_user,expected_error",
    [
        (None, USER_DOESNT_EXISTS),
        (User(login=LOGIN, deleted_at=utcnow()), USER_IS_DELETED),
        (User(login=LOGIN, disabled_at=True), USER_IS_DISABLED),
    ],
    ids=["user_doesnt_exists", "deleted", "disabled"],
)
async def test_get_user_by_login_with_validity_check_error(mocker, fake_user, expected_error):
    # Arrange
    mock_session = session_mock(mocker)
    mock_user_by_login = get_user_by_login_mock(mocker, fake_user)

    # Act
    with pytest.raises(UserLoginError) as error:
        await UserService.get_user_by_login_with_validity_check(mock_session, LOGIN)

    # Assert
    assert error.value.detail == str(expected_error)
    mock_user_by_login.assert_called_once_with(mock_session, LOGIN)


@pytest.mark.asyncio
async def test_patch_disable_user_success(mocker, use_time_machine):
    # Arrange
    fake_user = User(login=LOGIN)
    mock_session = session_mock(mocker)
    mock_get_user = get_user_mock(mocker, fake_user)

    # Act
    result = await UserAdminService.admin_patch_disable_user(mock_session, USER_ID)

    # Assert
    assert result is True
    assert fake_user.disabled_at == utcnow()
    mock_get_user.assert_called_once_with(mock_session, USER_ID)
    mock_session.commit.assert_called_once_with()


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "fake_user,expected_error",
    [
        (None, TARGET_USER_DOESNT_EXISTS),
        (User(login=LOGIN, deleted_at=utcnow()), TARGET_USER_IS_DELETED),
        (User(login=LOGIN, role=Roles.ADMIN), TARGET_USER_IS_ADMIN),
        (User(login=LOGIN, disabled_at=True), TARGET_USER_IS_ALREADY_DISABLED),
    ],
    ids=["user_doesnt_exists", "user_is_deleted", "user_is_admin", "user_is_disabled"],
)
async def test_patch_disable_user_error(mocker, fake_user, expected_error):
    # Arrange
    mock_session = session_mock(mocker)
    mock_get_user = get_user_mock(mocker, fake_user)

    # Act
    with pytest.raises(UserAdminError) as error:
        await UserAdminService.admin_patch_disable_user(mock_session, USER_ID)

    # Assert
    assert error.value.detail == str(expected_error)
    mock_get_user.assert_called_once_with(mock_session, USER_ID)
    mock_session.commit.assert_not_called()


@pytest.mark.asyncio
async def test_self_delete_success(mocker, use_time_machine):
    # Arrange
    current_time = utcnow()
    current_user = User(id=USER_ID, login=LOGIN, email=EMAIL, discord_id=DISCORD_ID)
    mock_session = session_mock(mocker)

    # Act
    result = await UserService.self_delete(mock_session, current_user)

    # Assert
    assert result is True
    assert current_user.deleted_at == current_time
    mock_session.commit.assert_called_once()


@pytest.mark.asyncio
async def test_self_delete_already_deleted(mocker):
    # Arrange
    deleted_at = datetime(2023, 1, 1, 12, 0, 0, tzinfo=UTC)
    current_user = User(
        id=USER_ID,
        login=LOGIN,
        email=EMAIL,
        discord_id=DISCORD_ID,
        deleted_at=deleted_at,
    )
    mock_session = session_mock(mocker)

    # Act
    with pytest.raises(UserAdminError) as error:
        await UserService.self_delete(mock_session, current_user)

    # Assert
    assert error.value.detail == str(TARGET_USER_IS_ALREADY_DELETED)
    assert current_user.deleted_at == deleted_at
    mock_session.commit.assert_not_called()


@pytest.mark.asyncio
async def test_patch_enable_user_success(mocker):
    # Arrange
    fake_user = User(login=LOGIN, disabled_at=True)
    mock_session = session_mock(mocker)
    mock_get_user = get_user_mock(mocker, fake_user)

    # Act
    result = await UserAdminService.admin_patch_enable_user(mock_session, USER_ID)

    # Assert
    assert result is True
    assert fake_user.disabled_at is None
    mock_get_user.assert_called_once_with(mock_session, USER_ID)
    mock_session.commit.assert_called_once_with()


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "fake_user,expected_error",
    [
        (None, TARGET_USER_DOESNT_EXISTS),
        (User(login=LOGIN, deleted_at=utcnow()), TARGET_USER_IS_DELETED),
        (User(login=LOGIN), TARGET_USER_IS_ALREADY_ENABLED),
    ],
    ids=["user_doesnt_exists", "user_is_deleted", "user_is_disabled"],
)
async def test_patch_enable_user_error(mocker, fake_user, expected_error):
    # Arrange
    mock_session = session_mock(mocker)
    mock_get_user = get_user_mock(mocker, fake_user)

    # Act
    with pytest.raises(UserAdminError) as error:
        await UserAdminService.admin_patch_enable_user(mock_session, USER_ID)

    # Assert
    assert error.value.detail == str(expected_error)
    mock_get_user.assert_called_once_with(mock_session, USER_ID)
    mock_session.commit.assert_not_called()


@pytest.mark.asyncio
async def test_delete_user_success(mocker, use_time_machine):
    # Arrange
    fake_user = User(login=LOGIN)
    mock_session = session_mock(mocker)
    mock_get_user = get_user_mock(mocker, fake_user)

    # Act
    result = await UserAdminService.admin_delete_user(mock_session, USER_ID)

    # Assert
    assert result is True
    assert fake_user.deleted_at == utcnow()
    mock_get_user.assert_called_once_with(mock_session, USER_ID)
    mock_session.commit.assert_called_once_with()


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "fake_user,expected_error",
    [
        (None, TARGET_USER_DOESNT_EXISTS),
        (User(login=LOGIN, deleted_at=utcnow()), TARGET_USER_IS_ALREADY_DELETED),
        (User(login=LOGIN, role=Roles.ADMIN), TARGET_USER_IS_ADMIN),
    ],
    ids=["user_doesnt_exists", "user_is_already_deleted", "user_is_an_admin"],
)
async def test_delete_user_error(mocker, fake_user, expected_error):
    # Arrange
    mock_session = session_mock(mocker)
    mock_get_user = get_user_mock(mocker, fake_user)

    # Act
    with pytest.raises(UserAdminError) as error:
        await UserAdminService.admin_delete_user(mock_session, USER_ID)

    # Assert
    assert error.value.detail == str(expected_error)
    mock_get_user.assert_called_once_with(mock_session, USER_ID)
    mock_session.commit.assert_not_called()


@pytest.mark.asyncio
async def test_update_login_success(mocker):
    # Arrange
    new_login = "NewLogin123"
    current_user = User(id=USER_ID, login=LOGIN)
    mock_session = session_mock(mocker)
    get_user_by_login_mock(mocker, None)

    # Act
    result = await UserService.update_login(mock_session, current_user, new_login)

    # Assert
    assert result.login == new_login
    mock_session.commit.assert_called_once()
    mock_session.refresh.assert_called_once_with(current_user)


@pytest.mark.asyncio
async def test_update_login_same_user_allowed(mocker):
    # Same user keeping their own login → no conflict
    current_user = User(id=USER_ID, login=LOGIN)
    mock_session = session_mock(mocker)
    get_user_by_login_mock(mocker, current_user)

    result = await UserService.update_login(mock_session, current_user, LOGIN)

    assert result.login == LOGIN
    mock_session.commit.assert_called_once()


@pytest.mark.asyncio
async def test_update_login_already_taken(mocker):
    # Arrange
    other_user = User(id=uuid.uuid4(), login="OtherLogin")
    current_user = User(id=USER_ID, login=LOGIN)
    mock_session = session_mock(mocker)
    get_user_by_login_mock(mocker, other_user)

    # Act / Assert
    with pytest.raises(Exception) as exc:
        await UserService.update_login(mock_session, current_user, "OtherLogin")

    assert exc.value.status_code == 409
    assert exc.value.detail == LOGIN_ALREADY_TAKEN.detail
    mock_session.commit.assert_not_called()


# =========================================================================
# get_user_by_id_with_validity_check — lines 68-69, 75-76
# =========================================================================


@pytest.mark.asyncio
async def test_get_user_by_id_with_validity_check_invalid_uuid(mocker):
    """Invalid UUID string hits lines 68-69 (ValueError branch)."""
    mock_session = session_mock(mocker)
    with pytest.raises(UserLoginError) as exc:
        await UserService.get_user_by_id_with_validity_check(mock_session, "not-a-uuid")
    assert exc.value.detail == str(USER_DOESNT_EXISTS)


@pytest.mark.asyncio
async def test_get_user_by_id_with_validity_check_empty_string(mocker):
    """Empty string hits lines 68-69 (ValueError branch)."""
    mock_session = session_mock(mocker)
    with pytest.raises(UserLoginError) as exc:
        await UserService.get_user_by_id_with_validity_check(mock_session, "")
    assert exc.value.detail == str(USER_DOESNT_EXISTS)


@pytest.mark.asyncio
async def test_get_user_by_id_with_validity_check_user_not_found(mocker):
    """Valid UUID but no user in DB hits line 72."""
    mock_session = session_mock(mocker)
    get_user_mock(mocker, None)
    with pytest.raises(UserLoginError) as exc:
        await UserService.get_user_by_id_with_validity_check(mock_session, str(USER_ID))
    assert exc.value.detail == str(USER_DOESNT_EXISTS)


@pytest.mark.asyncio
async def test_get_user_by_id_with_validity_check_deleted(mocker):
    """Deleted user hits line 74."""
    mock_session = session_mock(mocker)
    get_user_mock(mocker, User(login=LOGIN, deleted_at=utcnow()))
    with pytest.raises(UserLoginError) as exc:
        await UserService.get_user_by_id_with_validity_check(mock_session, str(USER_ID))
    assert exc.value.detail == str(USER_IS_DELETED)


@pytest.mark.asyncio
async def test_get_user_by_id_with_validity_check_disabled(mocker):
    """Disabled user hits lines 75-76."""
    mock_session = session_mock(mocker)
    fake_user = User(login=LOGIN, disabled_at=utcnow())
    get_user_mock(mocker, fake_user)
    with pytest.raises(UserLoginError) as exc:
        await UserService.get_user_by_id_with_validity_check(mock_session, str(USER_ID))
    assert exc.value.detail == str(USER_IS_DISABLED)


@pytest.mark.asyncio
async def test_get_user_by_id_with_validity_check_success(mocker):
    """Valid, active user returns the user object."""
    mock_session = session_mock(mocker)
    fake_user = User(login=LOGIN)
    get_user_mock(mocker, fake_user)
    result = await UserService.get_user_by_id_with_validity_check(mock_session, str(USER_ID))
    assert result == fake_user


# =========================================================================
# admin_patch_promote_user — line 173 (disabled_at cleared on promote)
# =========================================================================


@pytest.mark.asyncio
async def test_promote_user_success(mocker):
    """Promoting a user sets role=ADMIN and clears disabled_at (line 175)."""
    fake_user = User(login=LOGIN, disabled_at=utcnow())
    mock_session = session_mock(mocker)
    get_user_mock(mocker, fake_user)

    result = await UserAdminService.admin_patch_promote_user(mock_session, USER_ID)

    assert result is True
    assert fake_user.role == Roles.ADMIN
    assert fake_user.disabled_at is None
    mock_session.commit.assert_called_once_with()


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "fake_user,expected_error",
    [
        (None, TARGET_USER_DOESNT_EXISTS),
        (User(login=LOGIN, deleted_at=utcnow()), TARGET_USER_IS_DELETED),
        (User(login=LOGIN, role=Roles.SUPER_ADMIN), TARGET_USER_IS_SUPER_ADMIN),
        # forbid_admin=True in _validate_target_user_for_action raises TARGET_USER_IS_ADMIN
        (User(login=LOGIN, role=Roles.ADMIN), TARGET_USER_IS_ADMIN),
    ],
    ids=["not_found", "deleted", "super_admin", "already_admin"],
)
async def test_promote_user_errors(mocker, fake_user, expected_error):
    """Covers error branches in admin_patch_promote_user."""
    mock_session = session_mock(mocker)
    get_user_mock(mocker, fake_user)

    with pytest.raises(UserAdminError) as exc:
        await UserAdminService.admin_patch_promote_user(mock_session, USER_ID)

    assert exc.value.detail == str(expected_error)
    mock_session.commit.assert_not_called()


# =========================================================================
# admin_patch_demote_user — lines 181-192
# =========================================================================


@pytest.mark.asyncio
async def test_demote_user_success(mocker):
    """Demoting an admin sets role=USER (lines 190-192)."""
    fake_user = User(login=LOGIN, role=Roles.ADMIN)
    mock_session = session_mock(mocker)
    get_user_mock(mocker, fake_user)

    result = await UserAdminService.admin_patch_demote_user(mock_session, USER_ID)

    assert result is True
    assert fake_user.role == Roles.USER
    mock_session.commit.assert_called_once_with()


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "fake_user,expected_error",
    [
        (None, TARGET_USER_DOESNT_EXISTS),
        (User(login=LOGIN, deleted_at=utcnow()), TARGET_USER_IS_DELETED),
        (User(login=LOGIN, role=Roles.SUPER_ADMIN), TARGET_USER_IS_SUPER_ADMIN),
        (User(login=LOGIN, role=Roles.USER), TARGET_USER_IS_NOT_ADMIN),
    ],
    ids=["not_found", "deleted", "super_admin", "not_admin"],
)
async def test_demote_user_errors(mocker, fake_user, expected_error):
    """Covers lines 182-189: all error branches in admin_patch_demote_user."""
    mock_session = session_mock(mocker)
    get_user_mock(mocker, fake_user)

    with pytest.raises(UserAdminError) as exc:
        await UserAdminService.admin_patch_demote_user(mock_session, USER_ID)

    assert exc.value.detail == str(expected_error)
    mock_session.commit.assert_not_called()


# =========================================================================
# build_status_filter, build_role_filter, build_search_filter — lines 196-215
# =========================================================================


def test_build_status_filter_deleted():
    """status='deleted' adds deleted_at != None filter (line 197)."""
    from sqlmodel import select

    from src.models import User

    sql = select(User)
    result = UserAdminService.build_status_filter(sql, "deleted")
    assert result is not sql  # query was modified


def test_build_status_filter_disabled():
    """status='disabled' adds deleted_at==None + disabled_at!=None (lines 198-199)."""
    from sqlmodel import select

    sql = select(User)
    result = UserAdminService.build_status_filter(sql, "disabled")
    assert result is not sql


def test_build_status_filter_enabled():
    """status='enabled' adds both == None filters (lines 200-201)."""
    from sqlmodel import select

    sql = select(User)
    result = UserAdminService.build_status_filter(sql, "enabled")
    assert result is not sql


def test_build_status_filter_none():
    """status=None returns the same query object unchanged."""
    from sqlmodel import select

    sql = select(User)
    result = UserAdminService.build_status_filter(sql, None)
    assert result is sql


def test_build_role_filter_valid_role():
    """Known role adds a WHERE clause (line 207)."""
    from sqlmodel import select

    sql = select(User)
    result = UserAdminService.build_role_filter(sql, Roles.ADMIN)
    assert result is not sql


def test_build_role_filter_none():
    """role=None skips the WHERE clause."""
    from sqlmodel import select

    sql = select(User)
    result = UserAdminService.build_role_filter(sql, None)
    assert result is sql


def test_build_search_filter_with_value():
    """Non-empty search string adds ilike filter (lines 213-214)."""
    from sqlmodel import select

    sql = select(User)
    result = UserAdminService.build_search_filter(sql, "alice")
    assert result is not sql


def test_build_search_filter_whitespace_only():
    """Whitespace-only search is ignored (line 212 short-circuits)."""
    from sqlmodel import select

    sql = select(User)
    result = UserAdminService.build_search_filter(sql, "   ")
    assert result is sql


def test_build_search_filter_none():
    """None search is ignored."""
    from sqlmodel import select

    sql = select(User)
    result = UserAdminService.build_search_filter(sql, None)
    assert result is sql


# =========================================================================
# get_users / get_total_users with filters — lines 229-234, 249-253
# =========================================================================


@pytest.mark.asyncio
async def test_get_users_paginated_with_status(mocker):
    """get_users branch: status provided hits line 230."""
    mock_session = session_mock(mocker)
    await UserAdminService.get_users_paginated(mock_session, PAGE, SIZE, "enabled", None)
    mock_session.exec.assert_called_once()


@pytest.mark.asyncio
async def test_get_users_paginated_with_role(mocker):
    """get_users branch: role provided hits line 232."""
    mock_session = session_mock(mocker)
    await UserAdminService.get_users_paginated(mock_session, PAGE, SIZE, None, Roles.ADMIN)
    mock_session.exec.assert_called_once()


@pytest.mark.asyncio
async def test_get_users_paginated_with_search(mocker):
    """get_users branch: search provided hits line 234."""
    mock_session = session_mock(mocker)
    await UserAdminService.get_users_paginated(mock_session, PAGE, SIZE, None, None, "alice")
    mock_session.exec.assert_called_once()


@pytest.mark.asyncio
async def test_get_total_users_with_status(mocker):
    """get_total_users branch: status hits line 249."""
    mock_session = session_mock(mocker)
    await UserAdminService.get_total_users(mock_session, "disabled", None)
    mock_session.exec.assert_called_once()


@pytest.mark.asyncio
async def test_get_total_users_with_role(mocker):
    """get_total_users branch: role hits line 251."""
    mock_session = session_mock(mocker)
    await UserAdminService.get_total_users(mock_session, None, Roles.USER)
    mock_session.exec.assert_called_once()


@pytest.mark.asyncio
async def test_get_total_users_with_search(mocker):
    """get_total_users branch: search hits line 253."""
    mock_session = session_mock(mocker)
    await UserAdminService.get_total_users(mock_session, None, None, "bob")
    mock_session.exec.assert_called_once()

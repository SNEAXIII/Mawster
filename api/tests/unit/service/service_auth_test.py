import pytest

from src.enums.Roles import Roles
from src.Messages.jwt_messages import (
    INSUFFISANT_ROLE_EXCEPTION,
    JwtError,
)
from src.models import User
from src.services.auth.AuthService import AuthService
from src.services.auth.JWTService import JWTService
from tests.unit.service.mocks.session_mock import session_mock
from tests.unit.service.mocks.users_mock import get_user_with_validity_check_mock
from tests.utils.utils_constant import (
    DISCORD_ID,
    EMAIL,
    FAKE_TOKEN,
    LOGIN,
    UNKNOWN_ROLE,
    USER_ID,
)


def decode_service_mock(mocker, return_value: dict[str, str] | None):
    return mocker.patch.object(
        JWTService,
        "decode_jwt",
        return_value=return_value,
    )


@pytest.mark.asyncio
async def test_get_current_user_in_jwt_success(mocker):
    # Arrange
    user = User(login=LOGIN, email=EMAIL, discord_id=DISCORD_ID)
    mock_decode = decode_service_mock(mocker, {"user_id": str(USER_ID), "role": Roles.USER})
    mock_get_user = get_user_with_validity_check_mock(mocker, user)
    mock_session = session_mock(mocker)

    # Act
    result = await AuthService.get_current_user_in_jwt(mock_session, FAKE_TOKEN)

    # Assert
    mock_decode.assert_called_once_with(FAKE_TOKEN)
    mock_get_user.assert_called_once_with(mock_session, str(USER_ID))
    assert result == user


@pytest.mark.asyncio
async def test_get_current_user_in_jwt_user_not_found(mocker):
    # Arrange
    mock_decode = decode_service_mock(mocker, {"user_id": str(USER_ID), "role": Roles.USER})
    mock_get_user = get_user_with_validity_check_mock(mocker, None)
    mock_session = session_mock(mocker)

    # Act
    result = await AuthService.get_current_user_in_jwt(mock_session, FAKE_TOKEN)

    # Assert
    mock_decode.assert_called_once_with(FAKE_TOKEN)
    mock_get_user.assert_called_once_with(mock_session, str(USER_ID))
    assert result is None


@pytest.mark.asyncio
async def test_get_current_user_in_jwt_invalid_role_raises(mocker):
    """Unknown role should raise before hitting the DB."""
    mock_decode = decode_service_mock(mocker, {"user_id": str(USER_ID), "role": UNKNOWN_ROLE})
    mock_get_user = get_user_with_validity_check_mock(mocker, None)
    mock_session = session_mock(mocker)

    with pytest.raises(JwtError) as error:
        await AuthService.get_current_user_in_jwt(mock_session, FAKE_TOKEN)

    mock_decode.assert_called_once_with(FAKE_TOKEN)
    mock_get_user.assert_not_called()
    assert error.value.detail == str(INSUFFISANT_ROLE_EXCEPTION)


def guard_mocks(mocker, db_role: Roles):
    """The claim always says SUPER_ADMIN: only the DB role may decide."""
    decode_service_mock(mocker, {"user_id": str(USER_ID), "role": Roles.SUPER_ADMIN})
    user = User(login=LOGIN, email=EMAIL, discord_id=DISCORD_ID, role=db_role)
    get_user_with_validity_check_mock(mocker, user)
    return session_mock(mocker)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("method_to_test", "db_role"),
    [
        (AuthService.require_admin, Roles.ADMIN),
        (AuthService.require_admin, Roles.SUPER_ADMIN),
        (AuthService.require_super_admin, Roles.SUPER_ADMIN),
    ],
    ids=["admin-admin", "admin-super_admin", "super_admin-super_admin"],
)
async def test_require_role_success(mocker, method_to_test, db_role):
    mock_session = guard_mocks(mocker, db_role)

    result = await method_to_test(mock_session, FAKE_TOKEN)

    assert result is True


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("method_to_test", "db_role"),
    [
        (AuthService.require_admin, Roles.USER),
        (AuthService.require_super_admin, Roles.ADMIN),
        (AuthService.require_super_admin, Roles.USER),
    ],
    ids=["admin-user", "super_admin-admin", "super_admin-user"],
)
async def test_require_role_uses_db_role_not_claim(mocker, method_to_test, db_role):
    mock_session = guard_mocks(mocker, db_role)

    with pytest.raises(JwtError) as error:
        await method_to_test(mock_session, FAKE_TOKEN)

    assert error.value.detail == str(INSUFFISANT_ROLE_EXCEPTION)

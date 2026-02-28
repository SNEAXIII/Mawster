
import pytest

from src.Messages.jwt_messages import (
    JwtError,
    INSUFFISANT_ROLE_EXCEPTION,
)
from src.enums.Roles import Roles
from src.models import User
from src.services.AuthService import AuthService
from tests.unit.service.mocks.jwt_mock import decode_service_mock
from tests.unit.service.mocks.session_mock import session_mock
from tests.unit.service.mocks.users_mock import get_user_with_validity_check_mock

from tests.utils.utils_constant import (
    UNKNOWN_ROLE,
    FAKE_TOKEN,
    DISCORD_ID,
    LOGIN,
    EMAIL,
    USER_ID,
)


@pytest.mark.asyncio
async def test_get_current_user_in_jwt_success(mocker):
    # Arrange
    user = User(login=LOGIN, email=EMAIL, discord_id=DISCORD_ID)
    mock_decode = decode_service_mock(mocker, {"user_id": str(USER_ID)})
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
    mock_decode = decode_service_mock(mocker, {"user_id": str(USER_ID)})
    mock_get_user = get_user_with_validity_check_mock(mocker, None)
    mock_session = session_mock(mocker)

    # Act
    result = await AuthService.get_current_user_in_jwt(mock_session, FAKE_TOKEN)

    # Assert
    mock_decode.assert_called_once_with(FAKE_TOKEN)
    mock_get_user.assert_called_once_with(mock_session, str(USER_ID))
    assert result is None


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "role",
    list(Roles.__members__.values()),
)
async def test_is_logged_as_user_success(mocker, role):
    # Arrange
    mock_decode = decode_service_mock(mocker, {"role": role})

    # Act
    result = await AuthService.is_logged_as_user(FAKE_TOKEN)

    # Assert
    mock_decode.assert_called_once_with(FAKE_TOKEN)
    assert result is True


@pytest.mark.asyncio
async def test_is_logged_as_admin_success(mocker):
    # Arrange
    mock_decode = decode_service_mock(mocker, {"role": Roles.ADMIN})

    # Act
    result = await AuthService.is_logged_as_admin(FAKE_TOKEN)

    # Assert
    mock_decode.assert_called_once_with(FAKE_TOKEN)
    assert result is True


@pytest.mark.asyncio
async def test_is_logged_as_admin_super_admin_also_passes(mocker):
    """SUPER_ADMIN should also pass the is_logged_as_admin check."""
    # Arrange
    mock_decode = decode_service_mock(mocker, {"role": Roles.SUPER_ADMIN})

    # Act
    result = await AuthService.is_logged_as_admin(FAKE_TOKEN)

    # Assert
    mock_decode.assert_called_once_with(FAKE_TOKEN)
    assert result is True


@pytest.mark.asyncio
async def test_is_logged_as_super_admin_success(mocker):
    # Arrange
    mock_decode = decode_service_mock(mocker, {"role": Roles.SUPER_ADMIN})

    # Act
    result = await AuthService.is_logged_as_super_admin(FAKE_TOKEN)

    # Assert
    mock_decode.assert_called_once_with(FAKE_TOKEN)
    assert result is True


@pytest.mark.asyncio
async def test_is_logged_as_super_admin_admin_fails(mocker):
    """Regular ADMIN should NOT pass the is_logged_as_super_admin check."""
    # Arrange
    mock_decode = decode_service_mock(mocker, {"role": Roles.ADMIN})

    # Act
    with pytest.raises(JwtError) as error:
        await AuthService.is_logged_as_super_admin(FAKE_TOKEN)

    # Assert
    mock_decode.assert_called_once_with(FAKE_TOKEN)
    assert error.value.detail == str(INSUFFISANT_ROLE_EXCEPTION)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "method_to_test,role",
    [
        (AuthService.is_logged_as_admin, UNKNOWN_ROLE),
        (AuthService.is_logged_as_admin, Roles.USER),
        (AuthService.is_logged_as_user, UNKNOWN_ROLE),
    ],
    ids=[f"admin-{UNKNOWN_ROLE}", f"admin-{Roles.USER}", f"user-{UNKNOWN_ROLE}"],
)
async def test_is_logged_as_error(mocker, method_to_test, role):
    # Arrange
    mock_decode = decode_service_mock(mocker, {"role": role})

    # Act
    with pytest.raises(JwtError) as error:
        await method_to_test(FAKE_TOKEN)

    # Assert
    mock_decode.assert_called_once_with(FAKE_TOKEN)
    assert error.value.detail == str(INSUFFISANT_ROLE_EXCEPTION)

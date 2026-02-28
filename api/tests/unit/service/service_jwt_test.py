from datetime import datetime, timedelta, timezone

import pytest
from jwt import ExpiredSignatureError

from src.Messages.jwt_messages import (
    JwtError,
    EXPIRED_EXCEPTION,
    CANT_FIND_USER_TOKEN_EXCEPTION,
    INVALID_ROLE_EXCEPTION,
    JwtCredentialsError,
    CREDENTIALS_EXCEPTION,
)
from src.enums.Roles import Roles
from src.models import User
from src.security.secrets import SECRET
from src.services.JWTService import JWTService
from tests.unit.service.mocks.jwt_mock import (
    decode_module_mock,
    encode_mock,
    create_token_mock,
)
from tests.utils.utils_constant import FAKE_TOKEN, DISCORD_ID, LOGIN, EMAIL


def get_user():
    return User(login=LOGIN, email=EMAIL, discord_id=DISCORD_ID)


@pytest.mark.parametrize("role", Roles.__members__.values())
def test_decode_jwt_success(mocker, role):
    # Arrange
    data = {"user_id": "some-uuid", "role": role, "type": "access"}
    mock_decode = decode_module_mock(mocker, data)

    # Act
    result = JWTService.decode_jwt(FAKE_TOKEN)

    # Assert
    assert result is data
    mock_decode.assert_called_once_with(
        FAKE_TOKEN, SECRET.SECRET_KEY, algorithms=[SECRET.ALGORITHM]
    )


def test_decode_jwt_token_expired(mocker):
    # Arrange
    mock_decode = decode_module_mock(mocker, None)
    mock_decode.side_effect = ExpiredSignatureError

    # Act
    with pytest.raises(JwtError) as error:
        JWTService.decode_jwt(FAKE_TOKEN)

    # Assert
    mock_decode.assert_called_once_with(
        FAKE_TOKEN, SECRET.SECRET_KEY, algorithms=[SECRET.ALGORITHM]
    )
    assert error.value.detail == str(EXPIRED_EXCEPTION)


def test_decode_jwt_token_no_user(mocker):
    # Arrange
    data = {"role": Roles.USER, "type": "access"}
    mock_decode = decode_module_mock(mocker, data)

    # Act
    with pytest.raises(JwtError) as error:
        JWTService.decode_jwt(FAKE_TOKEN)

    # Assert
    mock_decode.assert_called_once_with(
        FAKE_TOKEN, SECRET.SECRET_KEY, algorithms=[SECRET.ALGORITHM]
    )
    assert error.value.detail == str(CANT_FIND_USER_TOKEN_EXCEPTION)


@pytest.mark.parametrize(
    "data",
    [
        {"user_id": "some-uuid", "role": "UnvalidRole", "type": "access"},
        {"user_id": "some-uuid", "type": "access"},
    ],
    ids=["unvalid_role", "missing_role"],
)
def test_decode_jwt_token_wrong_role(mocker, data):
    # Arrange
    mock_decode = decode_module_mock(mocker, data)

    # Act
    with pytest.raises(JwtError) as error:
        JWTService.decode_jwt(FAKE_TOKEN)

    # Assert
    mock_decode.assert_called_once_with(
        FAKE_TOKEN, SECRET.SECRET_KEY, algorithms=[SECRET.ALGORITHM]
    )
    assert error.value.detail == str(INVALID_ROLE_EXCEPTION)


def test_create_access_token_success(mocker):
    # Arrange
    user = get_user()
    mock_create_token = create_token_mock(mocker)
    expected_data = {
        "user_id": str(user.id),
        "role": user.role,
        "type": "access",
    }
    expected_expires_delta = timedelta(minutes=SECRET.ACCESS_TOKEN_EXPIRE_MINUTES)

    # Act
    JWTService.create_access_token(user)

    # Assert
    mock_create_token.assert_called_once_with(
        data=expected_data,
        expires_delta=expected_expires_delta,
    )


def test_create_access_token_no_user():
    # Arrange
    user = None

    # Act
    with pytest.raises(JwtCredentialsError) as error:
        JWTService.create_access_token(user)

    # Assert
    assert error.value.detail == str(CREDENTIALS_EXCEPTION)


def test_create_token_success(mocker, use_time_machine):
    # Arrange
    input_data = {"user_id": "some-uuid", "role": Roles.USER.value, "type": "access"}
    mock_encode_mock = encode_mock(mocker)
    expected_expires_delta = timedelta(minutes=SECRET.ACCESS_TOKEN_EXPIRE_MINUTES)
    expected_expires_date_time = datetime.now(tz=timezone.utc) + expected_expires_delta
    expected_data = {**input_data, "exp": expected_expires_date_time}

    # Act
    JWTService.create_token(input_data, expected_expires_delta)

    # Assert
    mock_encode_mock.assert_called_once_with(
        expected_data, SECRET.SECRET_KEY, algorithm=SECRET.ALGORITHM
    )

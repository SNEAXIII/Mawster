import pytest
from email_validator import EmailSyntaxError

from src.Messages.user_messages import (
    NOT_STR,
    EMAIL_INVALID,
    LOGIN_WRONG_SIZE,
    LOGIN_NON_ALPHANUM,
)

from src.validators.user_validator import (
    correct_email_validator,
    login_validator,
    MIN_LOGIN_LENGHT,
    MAX_LOGIN_LENGHT,
)
from tests.utils.utils_constant import LOGIN, EMAIL

# For login tests
login_wrong_size = LOGIN_WRONG_SIZE % (MIN_LOGIN_LENGHT, MAX_LOGIN_LENGHT)


def validate_email_mock(mocker):
    return mocker.patch("email_validator.validate_email")


def test_email_validator_success(mocker):
    # Arrange
    mock_validate_email = validate_email_mock(mocker)
    mock_validate_email.return_value = True

    # Act
    result = correct_email_validator(EMAIL)

    # Assert
    assert result is EMAIL
    mock_validate_email.assert_called_once_with(EMAIL)


def test_email_validator_error_email_not_str(mocker):
    # Arrange
    wrong_email = 123
    mock_validate_email = validate_email_mock(mocker)

    # Act
    with pytest.raises(ValueError) as error:
        correct_email_validator(wrong_email)

    # Assert
    assert error.value.args[0] == NOT_STR
    mock_validate_email.assert_not_called()


def test_email_validator_error_wrong_email(mocker):
    # Arrange
    mock_validate_email = validate_email_mock(mocker)
    mock_validate_email.side_effect = EmailSyntaxError()

    # Act
    with pytest.raises(EmailSyntaxError) as error:
        correct_email_validator(EMAIL)

    # Assert
    assert error.value.args[0] == EMAIL_INVALID
    mock_validate_email.assert_called_once_with(EMAIL)


def test_login_validator_success():
    # Act
    result = login_validator(LOGIN)

    # Assert
    assert result is LOGIN


@pytest.mark.parametrize(
    "login, error_message",
    [
        (1, NOT_STR),
        ("Lo", login_wrong_size),
        ("L" * (MAX_LOGIN_LENGHT + 1), login_wrong_size),
        (f"{LOGIN}!!{LOGIN}", LOGIN_NON_ALPHANUM),
    ],
    ids=[
        "login_not_str",
        "login_wrong_too_short",
        "login_wrong_too_long",
        "login_non_alphanum",
    ],
)
def test_login_validator_error(login, error_message):
    # Act
    with pytest.raises(ValueError) as error:
        login_validator(login)

    # Assert
    assert error.value.args[0] == error_message

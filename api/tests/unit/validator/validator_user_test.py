import pytest

from src.Messages.user_messages import (
    LOGIN_NON_ALPHANUM,
    LOGIN_WRONG_SIZE,
    NOT_STR,
)
from src.validators.user_validator import (
    MAX_LOGIN_LENGHT,
    MIN_LOGIN_LENGHT,
    login_validator,
)
from tests.utils.utils_constant import LOGIN

# For login tests
login_wrong_size = LOGIN_WRONG_SIZE % (MIN_LOGIN_LENGHT, MAX_LOGIN_LENGHT)


def test_login_validator_success():
    # Act
    result = login_validator(LOGIN)

    # Assert
    assert result is LOGIN


@pytest.mark.parametrize(
    ("login", "error_message"),
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

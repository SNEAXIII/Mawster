from src.Messages.user_messages import (
    LOGIN_NON_ALPHANUM,
    LOGIN_WRONG_SIZE,
    NOT_STR,
)

MIN_LOGIN_LENGHT = 4
MAX_LOGIN_LENGHT = 15


def login_validator(login: str) -> str:
    if not isinstance(login, str):
        raise ValueError(NOT_STR)
    login = login.strip()
    if not MIN_LOGIN_LENGHT <= len(login) <= MAX_LOGIN_LENGHT:
        raise ValueError(LOGIN_WRONG_SIZE % (MIN_LOGIN_LENGHT, MAX_LOGIN_LENGHT))
    if not login.isalnum():
        raise ValueError(LOGIN_NON_ALPHANUM)
    return login

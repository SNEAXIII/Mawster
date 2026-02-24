import email_validator
from email_validator import EmailSyntaxError
from src.Messages.user_messages import (
    EMAIL_INVALID,
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


def correct_email_validator(email: str) -> str:
    if not isinstance(email, str):
        raise ValueError(NOT_STR)
    email = email.strip()
    try:
        email_validator.validate_email(email)
    except EmailSyntaxError:
        raise EmailSyntaxError(EMAIL_INVALID)
    return email

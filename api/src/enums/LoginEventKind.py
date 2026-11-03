from enum import Enum


class LoginEventKind(str, Enum):
    LOGIN = "login"
    REFRESH = "refresh"

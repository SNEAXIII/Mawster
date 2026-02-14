from enum import Enum


class AuthProvider(str, Enum):
    LOCAL = "local"
    DISCORD = "discord"

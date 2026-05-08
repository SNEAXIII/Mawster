from enum import Enum


class InvitationType(str, Enum):
    MEMBER = "member"
    VISITOR = "visitor"

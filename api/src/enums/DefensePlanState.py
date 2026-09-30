from enum import Enum


class DefensePlanState(str, Enum):
    INCOMPLETE = "incomplete"
    VALIDATED = "validated"

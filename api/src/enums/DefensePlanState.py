from enum import Enum


class DefensePlanState(str, Enum):
    incomplete = "incomplete"
    validated = "validated"

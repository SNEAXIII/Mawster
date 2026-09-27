from enum import Enum


class DefensePlanState(str, Enum):
    pending = "pending"
    validated = "validated"

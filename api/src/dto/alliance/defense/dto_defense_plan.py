import uuid
from datetime import datetime

from pydantic import BaseModel, model_validator

from src.dto.alliance.defense.dto_defense_common import ChampionFields, DefenseNameRequest, Quota
from src.dto.mixins import SagaRoles
from src.enums.DefensePlanState import DefensePlanState
from src.enums.SeasonFormat import SeasonFormat


class DefensePlanNodeRequest(BaseModel):
    champion_id: uuid.UUID | None = None
    champion_user_id: uuid.UUID | None = None

    @model_validator(mode="after")
    def names_a_champion(self) -> DefensePlanNodeRequest:
        if self.champion_id is None and self.champion_user_id is None:
            message = "Give a champion or a roster entry"
            raise ValueError(message)
        return self


class DefensePlanCreateRequest(DefenseNameRequest):
    format: SeasonFormat
    template_id: uuid.UUID | None = None
    source_plan_id: uuid.UUID | None = None

    @model_validator(mode="after")
    def one_source_at_most(self) -> DefensePlanCreateRequest:
        if self.template_id is not None and self.source_plan_id is not None:
            message = "Pick a template or a plan to copy, not both"
            raise ValueError(message)
        return self


class DefensePlanNodeResponse(ChampionFields, SagaRoles):
    id: uuid.UUID
    battlegroup: int
    node_number: int
    champion_user_id: uuid.UUID | None = None
    game_account_id: uuid.UUID | None = None
    game_pseudo: str | None = None
    rarity: str | None = None
    signature: int = 0
    is_preferred_attacker: bool = False
    ascension: int = 0
    placed_by_id: uuid.UUID | None = None
    placed_by_pseudo: str | None = None


class DefensePlanSummary(BaseModel):
    id: uuid.UUID
    name: str
    battlegroup: int
    format: SeasonFormat
    state: DefensePlanState
    is_active: bool
    is_incomplete: bool
    filled_nodes: int
    created_at: datetime


class DefensePlanResponse(DefensePlanSummary):
    node_count: int
    max_defenders: int
    source_template_id: uuid.UUID | None = None
    nodes: list[DefensePlanNodeResponse]
    member_defender_counts: dict[str, int]


class DefensePlanListResponse(BaseModel):
    plans: list[DefensePlanSummary]
    quota: Quota


class ActivePlanResponse(BaseModel):
    battlegroup: int
    format: SeasonFormat
    plan: DefensePlanResponse | None = None

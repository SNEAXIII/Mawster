import uuid
from datetime import datetime

from pydantic import BaseModel

from src.dto.alliance.defense.dto_defense_common import ChampionFields, DefenseNameRequest, Quota
from src.enums.SeasonFormat import SeasonFormat


class DefenseTemplateCreateRequest(DefenseNameRequest):
    format: SeasonFormat
    source_template_id: uuid.UUID | None = None


class DefenseTemplateNodeRequest(BaseModel):
    champion_id: uuid.UUID


class DefenseTemplateNodeResponse(ChampionFields):
    node_number: int


class DefenseTemplateSummary(BaseModel):
    id: uuid.UUID
    name: str
    format: SeasonFormat
    filled_nodes: int
    created_at: datetime


class DefenseTemplateResponse(DefenseTemplateSummary):
    node_count: int
    nodes: list[DefenseTemplateNodeResponse]


class DefenseTemplateListResponse(BaseModel):
    templates: list[DefenseTemplateSummary]
    quota: Quota

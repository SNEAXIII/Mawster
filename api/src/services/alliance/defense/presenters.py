"""Turn Defense Templates and Plans into response DTOs."""

import uuid

from src.dto.alliance.defense.dto_defense_common import Quota
from src.dto.alliance.defense.dto_defense_template import (
    DefenseTemplateListResponse,
    DefenseTemplateNodeResponse,
    DefenseTemplateResponse,
    DefenseTemplateSummary,
)
from src.enums.SeasonFormat import SeasonFormat
from src.models.alliance.DefenseTemplate import DefenseTemplate
from src.models.champion.Champion import Champion
from src.services.alliance.defense.DefenseTemplateService import DefenseTemplateService
from src.services.alliance.defense.limits import MAX_TEMPLATES_PER_FORMAT
from src.services.alliance.war.WarFormatConfig import for_format
from src.utils.db import SessionDep


def champion_fields(champion: Champion) -> dict:
    return {
        "champion_id": champion.id,
        "champion_name": champion.name,
        "champion_alias": champion.alias,
        "champion_class": champion.champion_class,
        "champion_image_url": champion.image_url,
    }


def _template_summary(template: DefenseTemplate) -> dict:
    return {
        "id": template.id,
        "name": template.name,
        "format": template.format,
        "filled_nodes": len(template.nodes),
        "created_at": template.created_at,
    }


def template_response(template: DefenseTemplate) -> DefenseTemplateResponse:
    nodes = sorted(template.nodes, key=lambda n: n.node_number)
    return DefenseTemplateResponse(
        **_template_summary(template),
        node_count=for_format(template.format).node_count,
        nodes=[
            DefenseTemplateNodeResponse(node_number=n.node_number, **champion_fields(n.champion))
            for n in nodes
        ],
    )


async def template_list_response(
    session: SessionDep, alliance_id: uuid.UUID, fmt: SeasonFormat
) -> DefenseTemplateListResponse:
    templates = await DefenseTemplateService.list_templates(session, alliance_id, fmt)
    return DefenseTemplateListResponse(
        templates=[DefenseTemplateSummary(**_template_summary(t)) for t in templates],
        quota=Quota(used=len(templates), limit=MAX_TEMPLATES_PER_FORMAT),
    )

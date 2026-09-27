"""Turn Defense Templates and Plans into response DTOs."""

import uuid
from collections import Counter

from src.dto.alliance.defense.dto_defense_common import Quota
from src.dto.alliance.defense.dto_defense_plan import (
    DefensePlanListResponse,
    DefensePlanNodeResponse,
    DefensePlanResponse,
    DefensePlanSummary,
)
from src.dto.alliance.defense.dto_defense_template import (
    DefenseTemplateListResponse,
    DefenseTemplateNodeResponse,
    DefenseTemplateResponse,
    DefenseTemplateSummary,
)
from src.enums.DefensePlanState import DefensePlanState
from src.enums.SeasonFormat import SeasonFormat
from src.models.alliance.DefensePlan import DefensePlan, DefensePlanNode
from src.models.alliance.DefenseTemplate import DefenseTemplate
from src.models.champion.Champion import Champion
from src.services.admin.SagaService import SagaService
from src.services.alliance.defense.DefensePlanService import DefensePlanService
from src.services.alliance.defense.DefenseTemplateService import DefenseTemplateService
from src.services.alliance.defense.limits import (
    MAX_PLANS_PER_BATTLEGROUP_FORMAT,
    MAX_TEMPLATES_PER_FORMAT,
)
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


def _node_response(node: DefensePlanNode, battlegroup: int, saga: dict) -> DefensePlanNodeResponse:
    copy = node.champion_user
    is_saga_attacker, is_saga_defender = saga.get(node.champion_id, (False, False))
    player = (
        {
            "champion_user_id": copy.id,
            "game_account_id": copy.game_account_id,
            "game_pseudo": copy.game_account.game_pseudo,
            "rarity": copy.rarity,
            "signature": copy.signature,
            "is_preferred_attacker": copy.is_preferred_attacker,
            "ascension": copy.ascension,
        }
        if copy is not None
        else {}
    )
    return DefensePlanNodeResponse(
        id=node.id,
        battlegroup=battlegroup,
        node_number=node.node_number,
        is_saga_attacker=is_saga_attacker,
        is_saga_defender=is_saga_defender,
        placed_by_id=node.placed_by_id,
        placed_by_pseudo=node.placed_by.game_pseudo if node.placed_by else None,
        **champion_fields(node.champion),
        **player,
    )


def _plan_summary(plan: DefensePlan, member_ids: set[uuid.UUID], is_active: bool) -> dict:
    state = DefensePlanService.state_of(plan, member_ids)
    return {
        "id": plan.id,
        "name": plan.name,
        "battlegroup": plan.battlegroup,
        "format": plan.format,
        "state": state,
        "is_active": is_active,
        "is_incomplete": is_active and state == DefensePlanState.pending,
        "filled_nodes": len(plan.nodes),
        "created_at": plan.created_at,
    }


async def plan_response(session: SessionDep, plan: DefensePlan) -> DefensePlanResponse:
    member_ids = await DefensePlanService.bg_member_ids(session, plan.alliance_id, plan.battlegroup)
    active_ids = await DefensePlanService.active_plan_ids(
        session, plan.alliance_id, plan.battlegroup, plan.format
    )
    saga = await SagaService.resolve_current(session)
    params = for_format(plan.format)
    nodes = sorted(plan.nodes, key=lambda n: n.node_number)
    counts = Counter(str(n.champion_user.game_account_id) for n in nodes if n.champion_user)
    return DefensePlanResponse(
        **_plan_summary(plan, member_ids, plan.id in active_ids),
        node_count=params.node_count,
        max_defenders=params.max_defenders_per_player,
        source_template_id=plan.source_template_id,
        nodes=[_node_response(n, plan.battlegroup, saga) for n in nodes],
        member_defender_counts=dict(counts),
    )


async def plan_list_response(
    session: SessionDep, alliance_id: uuid.UUID, battlegroup: int, fmt: SeasonFormat
) -> DefensePlanListResponse:
    plans = await DefensePlanService.list_plans(session, alliance_id, battlegroup, fmt)
    member_ids = await DefensePlanService.bg_member_ids(session, alliance_id, battlegroup)
    active_ids = await DefensePlanService.active_plan_ids(session, alliance_id, battlegroup, fmt)
    return DefensePlanListResponse(
        plans=[
            DefensePlanSummary(**_plan_summary(p, member_ids, p.id in active_ids)) for p in plans
        ],
        quota=Quota(used=len(plans), limit=MAX_PLANS_PER_BATTLEGROUP_FORMAT),
    )

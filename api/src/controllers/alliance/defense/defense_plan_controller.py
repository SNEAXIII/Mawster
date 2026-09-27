import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from starlette import status

from src.dto.alliance.defense.dto_defense_common import DefenseNameRequest
from src.dto.alliance.defense.dto_defense_plan import (
    ActivePlanResponse,
    DefensePlanCreateRequest,
    DefensePlanListResponse,
    DefensePlanResponse,
)
from src.dto.alliance.defense.dto_defense_template import DefenseTemplateResponse
from src.enums.SeasonFormat import SeasonFormat
from src.models.alliance.DefensePlan import DefensePlan
from src.services.admin.SeasonService import SeasonService
from src.services.alliance.AllianceService import AllianceService
from src.services.alliance.defense.DefensePlanService import DefensePlanService
from src.services.alliance.defense.presenters import (
    plan_list_response,
    plan_response,
    template_response,
)
from src.services.auth.AuthService import AuthService
from src.utils.auth_deps import CurrentUser
from src.utils.db import SessionDep
from src.utils.path_params import BattlegroupPath

defense_plan_controller = APIRouter(
    prefix="/alliances/{alliance_id}/defense",
    tags=["Defense"],
    dependencies=[Depends(AuthService.get_current_user_in_jwt)],
)


async def load_plan(
    session: SessionDep, alliance_id: uuid.UUID, plan_id: uuid.UUID, user_id: uuid.UUID
) -> DefensePlan:
    """Placement right first, then the plan — a foreign plan id is a 404, never a 403."""
    await AllianceService.require_strategist(session, alliance_id, user_id)
    return await DefensePlanService.get_plan(session, alliance_id, plan_id)


@defense_plan_controller.get("/bg/{battlegroup}/active", response_model=ActivePlanResponse)
async def get_active_plan(
    alliance_id: uuid.UUID,
    battlegroup: BattlegroupPath,
    session: SessionDep,
    current_user: CurrentUser,
):
    await AllianceService.require_visitor(session, alliance_id, current_user.id)
    fmt = await SeasonService.get_current_format(session)
    plan = await DefensePlanService.get_active_plan(session, alliance_id, battlegroup, fmt)
    return ActivePlanResponse(
        battlegroup=battlegroup,
        format=fmt,
        plan=await plan_response(session, plan) if plan else None,
    )


@defense_plan_controller.get("/bg/{battlegroup}/plans", response_model=DefensePlanListResponse)
async def list_plans(
    alliance_id: uuid.UUID,
    battlegroup: BattlegroupPath,
    fmt: Annotated[SeasonFormat, Query(alias="format")],
    session: SessionDep,
    current_user: CurrentUser,
):
    await AllianceService.require_strategist(session, alliance_id, current_user.id)
    return await plan_list_response(session, alliance_id, battlegroup, fmt)


@defense_plan_controller.post(
    "/bg/{battlegroup}/plans",
    response_model=DefensePlanResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_plan(
    alliance_id: uuid.UUID,
    battlegroup: BattlegroupPath,
    body: DefensePlanCreateRequest,
    session: SessionDep,
    current_user: CurrentUser,
):
    await AllianceService.require_strategist(session, alliance_id, current_user.id)
    plan = await DefensePlanService.create_plan(
        session,
        alliance_id,
        battlegroup,
        body.name,
        body.format,
        template_id=body.template_id,
        source_plan_id=body.source_plan_id,
    )
    return await plan_response(session, plan)


@defense_plan_controller.get("/plans/{plan_id}", response_model=DefensePlanResponse)
async def get_plan(
    alliance_id: uuid.UUID, plan_id: uuid.UUID, session: SessionDep, current_user: CurrentUser
):
    return await plan_response(
        session, await load_plan(session, alliance_id, plan_id, current_user.id)
    )


@defense_plan_controller.patch("/plans/{plan_id}", response_model=DefensePlanResponse)
async def rename_plan(
    alliance_id: uuid.UUID,
    plan_id: uuid.UUID,
    body: DefenseNameRequest,
    session: SessionDep,
    current_user: CurrentUser,
):
    plan = await load_plan(session, alliance_id, plan_id, current_user.id)
    return await plan_response(
        session, await DefensePlanService.rename_plan(session, plan, body.name)
    )


@defense_plan_controller.delete("/plans/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_plan(
    alliance_id: uuid.UUID, plan_id: uuid.UUID, session: SessionDep, current_user: CurrentUser
):
    plan = await load_plan(session, alliance_id, plan_id, current_user.id)
    await DefensePlanService.delete_plan(session, plan)


@defense_plan_controller.post("/plans/{plan_id}/activate", response_model=DefensePlanResponse)
async def activate_plan(
    alliance_id: uuid.UUID, plan_id: uuid.UUID, session: SessionDep, current_user: CurrentUser
):
    plan = await load_plan(session, alliance_id, plan_id, current_user.id)
    return await plan_response(session, await DefensePlanService.activate(session, plan))


@defense_plan_controller.post(
    "/plans/{plan_id}/template",
    response_model=DefenseTemplateResponse,
    status_code=status.HTTP_201_CREATED,
)
async def save_plan_as_template(
    alliance_id: uuid.UUID,
    plan_id: uuid.UUID,
    body: DefenseNameRequest,
    session: SessionDep,
    current_user: CurrentUser,
):
    plan = await load_plan(session, alliance_id, plan_id, current_user.id)
    return template_response(await DefensePlanService.save_as_template(session, plan, body.name))

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from starlette import status

from src.controllers.alliance.defense.defense_plan_controller import load_plan
from src.dto.alliance.defense.dto_defense_plan import DefensePlanNodeRequest, DefensePlanResponse
from src.game_types import NodeNumber
from src.services.admin.SeasonService import SeasonService
from src.services.alliance.AllianceService import AllianceService
from src.services.alliance.defense.DefensePlanNodeService import DefensePlanNodeService
from src.services.alliance.defense.DefensePlanService import DefensePlanService
from src.services.alliance.defense.presenters import plan_response
from src.services.auth.AuthService import AuthService
from src.utils.auth_deps import CurrentUser
from src.utils.db import SessionDep
from src.utils.path_params import BattlegroupPath, NodeNumberPath

defense_plan_node_controller = APIRouter(
    prefix="/alliances/{alliance_id}/defense",
    tags=["Defense"],
    dependencies=[Depends(AuthService.get_current_user_in_jwt)],
)


@defense_plan_node_controller.put(
    "/plans/{plan_id}/nodes/{node_number}", response_model=DefensePlanResponse
)
async def set_plan_node(
    alliance_id: uuid.UUID,
    plan_id: uuid.UUID,
    node_number: NodeNumberPath,
    body: DefensePlanNodeRequest,
    session: SessionDep,
    current_user: CurrentUser,
):
    author = await AllianceService.require_strategist_account(session, alliance_id, current_user.id)
    plan = await DefensePlanService.get_plan(session, alliance_id, plan_id)
    updated = await DefensePlanNodeService.set_node(
        session, plan, node_number, body.champion_id, body.champion_user_id, author.id
    )
    return await plan_response(session, updated)


@defense_plan_node_controller.delete(
    "/plans/{plan_id}/nodes/{node_number}", status_code=status.HTTP_204_NO_CONTENT
)
async def remove_plan_node(
    alliance_id: uuid.UUID,
    plan_id: uuid.UUID,
    node_number: NodeNumberPath,
    session: SessionDep,
    current_user: CurrentUser,
):
    plan = await load_plan(session, alliance_id, plan_id, current_user.id)
    await DefensePlanNodeService.remove_node(session, plan, node_number)


@defense_plan_node_controller.delete(
    "/plans/{plan_id}/nodes", status_code=status.HTTP_204_NO_CONTENT
)
async def clear_plan(
    alliance_id: uuid.UUID, plan_id: uuid.UUID, session: SessionDep, current_user: CurrentUser
):
    plan = await load_plan(session, alliance_id, plan_id, current_user.id)
    await DefensePlanNodeService.clear_plan(session, plan)


@defense_plan_node_controller.get("/plans/{plan_id}/available-champions")
async def get_plan_available_champions(
    alliance_id: uuid.UUID,
    plan_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
    node_number: Annotated[NodeNumber | None, Query()] = None,
):
    plan = await load_plan(session, alliance_id, plan_id, current_user.id)
    return await DefensePlanNodeService.available_champions(session, plan, node_number)


@defense_plan_node_controller.get("/plans/{plan_id}/members")
async def get_plan_members(
    alliance_id: uuid.UUID, plan_id: uuid.UUID, session: SessionDep, current_user: CurrentUser
):
    plan = await load_plan(session, alliance_id, plan_id, current_user.id)
    return await DefensePlanNodeService.members_with_counts(
        session, alliance_id, plan.battlegroup, plan
    )


@defense_plan_node_controller.get("/bg/{battlegroup}/members")
async def get_bg_members(
    alliance_id: uuid.UUID,
    battlegroup: BattlegroupPath,
    session: SessionDep,
    current_user: CurrentUser,
):
    await AllianceService.require_visitor(session, alliance_id, current_user.id)
    fmt = await SeasonService.get_current_format(session)
    plan = await DefensePlanService.get_active_plan(session, alliance_id, battlegroup, fmt)
    return await DefensePlanNodeService.members_with_counts(session, alliance_id, battlegroup, plan)

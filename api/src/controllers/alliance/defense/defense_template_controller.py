import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from starlette import status

from src.dto.alliance.defense.dto_defense_common import DefenseNameRequest
from src.dto.alliance.defense.dto_defense_template import (
    DefenseTemplateCreateRequest,
    DefenseTemplateListResponse,
    DefenseTemplateNodeRequest,
    DefenseTemplateResponse,
)
from src.enums.SeasonFormat import SeasonFormat
from src.models.alliance.DefenseTemplate import DefenseTemplate
from src.services.alliance.AllianceService import AllianceService
from src.services.alliance.defense.DefenseTemplateService import DefenseTemplateService
from src.services.alliance.defense.presenters import template_list_response, template_response
from src.services.auth.AuthService import AuthService
from src.utils.auth_deps import CurrentUser
from src.utils.db import SessionDep
from src.utils.path_params import NodeNumberPath

defense_template_controller = APIRouter(
    prefix="/alliances/{alliance_id}/defense/templates",
    tags=["Defense"],
    dependencies=[Depends(AuthService.get_current_user_in_jwt)],
)


async def _template(
    session: SessionDep, alliance_id: uuid.UUID, template_id: uuid.UUID, user_id: uuid.UUID
) -> DefenseTemplate:
    await AllianceService.require_strategist(session, alliance_id, user_id)
    return await DefenseTemplateService.get_template(session, alliance_id, template_id)


@defense_template_controller.get("", response_model=DefenseTemplateListResponse)
async def list_templates(
    alliance_id: uuid.UUID,
    fmt: Annotated[SeasonFormat, Query(alias="format")],
    session: SessionDep,
    current_user: CurrentUser,
):
    await AllianceService.require_strategist(session, alliance_id, current_user.id)
    return await template_list_response(session, alliance_id, fmt)


@defense_template_controller.post(
    "", response_model=DefenseTemplateResponse, status_code=status.HTTP_201_CREATED
)
async def create_template(
    alliance_id: uuid.UUID,
    body: DefenseTemplateCreateRequest,
    session: SessionDep,
    current_user: CurrentUser,
):
    await AllianceService.require_strategist(session, alliance_id, current_user.id)
    template = await DefenseTemplateService.create_template(
        session, alliance_id, body.name, body.format, body.source_template_id
    )
    return template_response(template)


@defense_template_controller.get("/{template_id}", response_model=DefenseTemplateResponse)
async def get_template(
    alliance_id: uuid.UUID, template_id: uuid.UUID, session: SessionDep, current_user: CurrentUser
):
    return template_response(await _template(session, alliance_id, template_id, current_user.id))


@defense_template_controller.patch("/{template_id}", response_model=DefenseTemplateResponse)
async def rename_template(
    alliance_id: uuid.UUID,
    template_id: uuid.UUID,
    body: DefenseNameRequest,
    session: SessionDep,
    current_user: CurrentUser,
):
    template = await _template(session, alliance_id, template_id, current_user.id)
    return template_response(
        await DefenseTemplateService.rename_template(session, template, body.name)
    )


@defense_template_controller.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template(
    alliance_id: uuid.UUID, template_id: uuid.UUID, session: SessionDep, current_user: CurrentUser
):
    template = await _template(session, alliance_id, template_id, current_user.id)
    await DefenseTemplateService.delete_template(session, template)


@defense_template_controller.put(
    "/{template_id}/nodes/{node_number}", response_model=DefenseTemplateResponse
)
async def set_template_node(
    alliance_id: uuid.UUID,
    template_id: uuid.UUID,
    node_number: NodeNumberPath,
    body: DefenseTemplateNodeRequest,
    session: SessionDep,
    current_user: CurrentUser,
):
    template = await _template(session, alliance_id, template_id, current_user.id)
    updated = await DefenseTemplateService.set_node(
        session, template, node_number, body.champion_id
    )
    return template_response(updated)


@defense_template_controller.delete(
    "/{template_id}/nodes/{node_number}", status_code=status.HTTP_204_NO_CONTENT
)
async def remove_template_node(
    alliance_id: uuid.UUID,
    template_id: uuid.UUID,
    node_number: NodeNumberPath,
    session: SessionDep,
    current_user: CurrentUser,
):
    template = await _template(session, alliance_id, template_id, current_user.id)
    await DefenseTemplateService.remove_node(session, template, node_number)

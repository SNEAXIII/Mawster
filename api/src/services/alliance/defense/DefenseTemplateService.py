import uuid

from fastapi import HTTPException
from sqlalchemy.orm import selectinload
from sqlmodel import select
from starlette import status

from src.enums.SeasonFormat import SeasonFormat
from src.Messages.defense_messages import (
    TEMPLATE_NAME_TAKEN,
    TEMPLATE_NOT_FOUND,
    template_quota_reached,
)
from src.models.alliance.DefenseTemplate import DefenseTemplate, DefenseTemplateNode
from src.services.alliance.defense._rules import (
    assert_champion_exists,
    assert_champion_free,
    assert_name_free,
    assert_node_on_map,
    assert_same_format,
    count_rows,
    delete_node,
    find_node,
)
from src.services.alliance.defense.limits import MAX_TEMPLATES_PER_FORMAT
from src.utils.db import SessionDep

_TEMPLATE_OPTIONS = (
    selectinload(DefenseTemplate.nodes).selectinload(DefenseTemplateNode.champion),  # type: ignore[arg-type]
)


class DefenseTemplateService:
    @staticmethod
    async def get_template(
        session: SessionDep, alliance_id: uuid.UUID, template_id: uuid.UUID
    ) -> DefenseTemplate:
        template = (
            await session.exec(
                select(DefenseTemplate)
                .where(
                    DefenseTemplate.id == template_id, DefenseTemplate.alliance_id == alliance_id
                )
                .options(*_TEMPLATE_OPTIONS)
                .execution_options(populate_existing=True)
            )
        ).first()
        if template is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, TEMPLATE_NOT_FOUND)
        return template

    @staticmethod
    async def list_templates(
        session: SessionDep, alliance_id: uuid.UUID, fmt: SeasonFormat
    ) -> list[DefenseTemplate]:
        result = await session.exec(
            select(DefenseTemplate)
            .where(DefenseTemplate.alliance_id == alliance_id, DefenseTemplate.format == fmt)
            .order_by(DefenseTemplate.created_at)  # type: ignore[arg-type]
            .options(*_TEMPLATE_OPTIONS)
        )
        return list(result.all())

    @classmethod
    async def create_template(
        cls,
        session: SessionDep,
        alliance_id: uuid.UUID,
        name: str,
        fmt: SeasonFormat,
        source_template_id: uuid.UUID | None = None,
    ) -> DefenseTemplate:
        champion_nodes: list[tuple[int, uuid.UUID]] = []
        if source_template_id is not None:
            source = await cls.get_template(session, alliance_id, source_template_id)
            assert_same_format(source.format, fmt)
            champion_nodes = [(n.node_number, n.champion_id) for n in source.nodes]
        return await cls.create_with_nodes(session, alliance_id, name, fmt, champion_nodes)

    @classmethod
    async def create_with_nodes(
        cls,
        session: SessionDep,
        alliance_id: uuid.UUID,
        name: str,
        fmt: SeasonFormat,
        champion_nodes: list[tuple[int, uuid.UUID]],
    ) -> DefenseTemplate:
        used = await count_rows(
            session,
            DefenseTemplate,
            DefenseTemplate.alliance_id == alliance_id,
            DefenseTemplate.format == fmt,
        )
        if used >= MAX_TEMPLATES_PER_FORMAT:
            raise HTTPException(
                status.HTTP_409_CONFLICT, template_quota_reached(MAX_TEMPLATES_PER_FORMAT)
            )
        await cls._assert_name_free(session, alliance_id, fmt, name)
        template = DefenseTemplate(alliance_id=alliance_id, format=fmt, name=name)
        template.nodes = [
            DefenseTemplateNode(node_number=node, champion_id=champion_id)
            for node, champion_id in champion_nodes
        ]
        session.add(template)
        await session.commit()
        return await cls.get_template(session, alliance_id, template.id)

    @classmethod
    async def rename_template(
        cls, session: SessionDep, template: DefenseTemplate, name: str
    ) -> DefenseTemplate:
        if name != template.name:
            await cls._assert_name_free(session, template.alliance_id, template.format, name)
        template.name = name
        session.add(template)
        await session.commit()
        return await cls.get_template(session, template.alliance_id, template.id)

    @staticmethod
    async def delete_template(session: SessionDep, template: DefenseTemplate) -> None:
        await session.delete(template)
        await session.commit()

    @classmethod
    async def set_node(
        cls,
        session: SessionDep,
        template: DefenseTemplate,
        node_number: int,
        champion_id: uuid.UUID,
    ) -> DefenseTemplate:
        assert_node_on_map(template.format, node_number)
        await assert_champion_exists(session, champion_id)
        assert_champion_free(template.nodes, champion_id, node_number)
        node = find_node(template.nodes, node_number) or DefenseTemplateNode(
            template_id=template.id, node_number=node_number
        )
        node.champion_id = champion_id
        session.add(node)
        await session.commit()
        return await cls.get_template(session, template.alliance_id, template.id)

    @staticmethod
    async def remove_node(session: SessionDep, template: DefenseTemplate, node_number: int) -> None:
        await delete_node(session, template.nodes, node_number)

    @staticmethod
    async def _assert_name_free(
        session: SessionDep, alliance_id: uuid.UUID, fmt: SeasonFormat, name: str
    ) -> None:
        await assert_name_free(
            session,
            DefenseTemplate,
            name,
            TEMPLATE_NAME_TAKEN,
            DefenseTemplate.alliance_id == alliance_id,
            DefenseTemplate.format == fmt,
        )

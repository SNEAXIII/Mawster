import uuid
from collections.abc import Sequence

from fastapi import HTTPException
from sqlalchemy.orm import selectinload
from sqlmodel import col, select
from starlette import status

from src.enums.DefensePlanState import DefensePlanState
from src.enums.SeasonFormat import SeasonFormat
from src.Messages.defense_messages import (
    PLAN_NAME_TAKEN,
    PLAN_NOT_FOUND,
    PLAN_NOT_VALIDATED,
    SOURCE_PLAN_OTHER_BATTLEGROUP,
    plan_quota_reached,
)
from src.models.alliance.DefensePlan import DefenseActivePlan, DefensePlan, DefensePlanNode
from src.models.alliance.DefenseTemplate import DefenseTemplate
from src.models.champion.ChampionUser import ChampionUser
from src.services.alliance.defense._rules import (
    assert_name_free,
    assert_same_format,
    bg_members,
    count_rows,
)
from src.services.alliance.defense.DefenseTemplateService import DefenseTemplateService
from src.services.alliance.defense.limits import MAX_PLANS_PER_BATTLEGROUP_FORMAT
from src.services.alliance.defense.plan_state import compute_plan_state
from src.services.alliance.war.WarFormatConfig import for_format
from src.utils.db import SessionDep

_NODES = selectinload(DefensePlan.nodes)  # type: ignore[arg-type]
PLAN_OPTIONS = (
    _NODES.selectinload(DefensePlanNode.champion),  # type: ignore[arg-type]
    _NODES.selectinload(DefensePlanNode.champion_user).selectinload(ChampionUser.game_account),  # type: ignore[arg-type]
    _NODES.selectinload(DefensePlanNode.placed_by),  # type: ignore[arg-type]
)


def _scope(alliance_id: uuid.UUID, battlegroup: int, fmt: SeasonFormat, model=DefensePlan) -> tuple:
    return model.alliance_id == alliance_id, model.battlegroup == battlegroup, model.format == fmt


async def _drop_players(session: SessionDep, nodes: Sequence[DefensePlanNode]) -> None:
    """The Champion stays on the node; only its Player leaves."""
    for node in nodes:
        node.champion_user_id = None
        session.add(node)
    await session.flush()


class DefensePlanService:
    @staticmethod
    async def get_plan(
        session: SessionDep, alliance_id: uuid.UUID, plan_id: uuid.UUID
    ) -> DefensePlan:
        plan = (
            await session.exec(
                select(DefensePlan)
                .where(DefensePlan.id == plan_id, DefensePlan.alliance_id == alliance_id)
                .options(*PLAN_OPTIONS)
                .execution_options(populate_existing=True)
            )
        ).first()
        if plan is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, PLAN_NOT_FOUND)
        return plan

    @staticmethod
    async def list_plans(
        session: SessionDep, alliance_id: uuid.UUID, battlegroup: int, fmt: SeasonFormat
    ) -> list[DefensePlan]:
        result = await session.exec(
            select(DefensePlan)
            .where(*_scope(alliance_id, battlegroup, fmt))
            .order_by(DefensePlan.created_at)  # type: ignore[arg-type]
            .options(*PLAN_OPTIONS)
        )
        return list(result.all())

    @staticmethod
    async def get_active_plan(
        session: SessionDep, alliance_id: uuid.UUID, battlegroup: int, fmt: SeasonFormat
    ) -> DefensePlan | None:
        result = await session.exec(
            select(DefensePlan)
            .join(DefenseActivePlan, DefenseActivePlan.plan_id == DefensePlan.id)  # type: ignore[arg-type]
            .where(*_scope(alliance_id, battlegroup, fmt, DefenseActivePlan))
            .options(*PLAN_OPTIONS)
        )
        return result.first()

    @staticmethod
    async def active_plan_ids(
        session: SessionDep, alliance_id: uuid.UUID, battlegroup: int, fmt: SeasonFormat
    ) -> set[uuid.UUID]:
        result = await session.exec(
            select(DefenseActivePlan.plan_id).where(
                *_scope(alliance_id, battlegroup, fmt, DefenseActivePlan)
            )
        )
        return set(result.all())

    @staticmethod
    async def bg_member_ids(
        session: SessionDep, alliance_id: uuid.UUID, battlegroup: int
    ) -> set[uuid.UUID]:
        members = await bg_members(session, alliance_id, battlegroup)
        return {m.id for m in members}

    @staticmethod
    def active_defender_ids(
        alliance_id: uuid.UUID, fmt: SeasonFormat, battlegroup: int | None = None
    ):
        """Roster Entries "on defense": on an Active Plan. Other plans block nothing."""
        stmt = (
            select(DefensePlanNode.champion_user_id)
            .join(DefenseActivePlan, DefenseActivePlan.plan_id == DefensePlanNode.plan_id)  # type: ignore[arg-type]
            .where(
                DefenseActivePlan.alliance_id == alliance_id,
                DefenseActivePlan.format == fmt,
                col(DefensePlanNode.champion_user_id).is_not(None),
            )
        )
        if battlegroup is not None:
            stmt = stmt.where(DefenseActivePlan.battlegroup == battlegroup)
        return stmt

    @staticmethod
    async def release_member(
        session: SessionDep, alliance_id: uuid.UUID, game_account_id: uuid.UUID
    ) -> int:
        """Drop the Player from every node they hold, keeping the Champion. Flushes, never commits."""
        nodes = (
            await session.exec(
                select(DefensePlanNode)
                .join(DefensePlan, DefensePlan.id == DefensePlanNode.plan_id)  # type: ignore[arg-type]
                .join(ChampionUser, ChampionUser.id == DefensePlanNode.champion_user_id)  # type: ignore[arg-type]
                .where(
                    DefensePlan.alliance_id == alliance_id,
                    ChampionUser.game_account_id == game_account_id,
                )
            )
        ).all()
        await _drop_players(session, nodes)
        return len(nodes)

    @staticmethod
    async def release_champion_users(
        session: SessionDep, champion_user_ids: Sequence[uuid.UUID]
    ) -> None:
        if not champion_user_ids:
            return
        nodes = (
            await session.exec(
                select(DefensePlanNode).where(
                    col(DefensePlanNode.champion_user_id).in_(champion_user_ids)
                )
            )
        ).all()
        await _drop_players(session, nodes)

    @staticmethod
    def state_of(plan: DefensePlan, member_ids: set[uuid.UUID]) -> DefensePlanState:
        params = for_format(plan.format)
        assignees = [
            n.champion_user.game_account_id if n.champion_user else None for n in plan.nodes
        ]
        return compute_plan_state(
            assignees, member_ids, params.node_count, params.max_defenders_per_player
        )

    @classmethod
    async def create_plan(
        cls,
        session: SessionDep,
        alliance_id: uuid.UUID,
        battlegroup: int,
        name: str,
        fmt: SeasonFormat,
        template_id: uuid.UUID | None = None,
        source_plan_id: uuid.UUID | None = None,
    ) -> DefensePlan:
        if await count_rows(session, DefensePlan, *_scope(alliance_id, battlegroup, fmt)) >= (
            MAX_PLANS_PER_BATTLEGROUP_FORMAT
        ):
            raise HTTPException(
                status.HTTP_409_CONFLICT, plan_quota_reached(MAX_PLANS_PER_BATTLEGROUP_FORMAT)
            )
        await cls._assert_name_free(session, alliance_id, battlegroup, fmt, name)
        plan = DefensePlan(alliance_id=alliance_id, battlegroup=battlegroup, format=fmt, name=name)
        if template_id is not None:
            template = await DefenseTemplateService.get_template(session, alliance_id, template_id)
            assert_same_format(template.format, fmt)
            plan.source_template_id = template.id
            plan.nodes = [
                DefensePlanNode(node_number=n.node_number, champion_id=n.champion_id)
                for n in template.nodes
            ]
        elif source_plan_id is not None:
            source = await cls.get_plan(session, alliance_id, source_plan_id)
            assert_same_format(source.format, fmt)
            if source.battlegroup != battlegroup:
                raise HTTPException(status.HTTP_400_BAD_REQUEST, SOURCE_PLAN_OTHER_BATTLEGROUP)
            plan.source_template_id = source.source_template_id
            plan.nodes = [
                DefensePlanNode(
                    node_number=n.node_number,
                    champion_id=n.champion_id,
                    champion_user_id=n.champion_user_id,
                    placed_by_id=n.placed_by_id,
                )
                for n in source.nodes
            ]
        session.add(plan)
        await session.commit()
        return await cls.get_plan(session, alliance_id, plan.id)

    @classmethod
    async def rename_plan(cls, session: SessionDep, plan: DefensePlan, name: str) -> DefensePlan:
        if name != plan.name:
            await cls._assert_name_free(
                session, plan.alliance_id, plan.battlegroup, plan.format, name
            )
        plan.name = name
        session.add(plan)
        await session.commit()
        return await cls.get_plan(session, plan.alliance_id, plan.id)

    @staticmethod
    async def delete_plan(session: SessionDep, plan: DefensePlan) -> None:
        pointer = (
            await session.exec(
                select(DefenseActivePlan).where(DefenseActivePlan.plan_id == plan.id)
            )
        ).first()
        if pointer is not None:
            await session.delete(pointer)
        await session.delete(plan)
        await session.commit()

    @classmethod
    async def activate(cls, session: SessionDep, plan: DefensePlan) -> DefensePlan:
        members = await cls.bg_member_ids(session, plan.alliance_id, plan.battlegroup)
        if cls.state_of(plan, members) != DefensePlanState.validated:
            raise HTTPException(status.HTTP_409_CONFLICT, PLAN_NOT_VALIDATED)
        pointer = (
            await session.exec(
                select(DefenseActivePlan).where(
                    *_scope(plan.alliance_id, plan.battlegroup, plan.format, DefenseActivePlan)
                )
            )
        ).first()
        if pointer is None:
            pointer = DefenseActivePlan(
                alliance_id=plan.alliance_id, battlegroup=plan.battlegroup, format=plan.format
            )
        pointer.plan_id = plan.id
        session.add(pointer)
        await session.commit()
        return await cls.get_plan(session, plan.alliance_id, plan.id)

    @staticmethod
    async def save_as_template(
        session: SessionDep, plan: DefensePlan, name: str
    ) -> DefenseTemplate:
        champion_nodes = [(n.node_number, n.champion_id) for n in plan.nodes]
        return await DefenseTemplateService.create_with_nodes(
            session, plan.alliance_id, name, plan.format, champion_nodes
        )

    @staticmethod
    async def _assert_name_free(
        session: SessionDep, alliance_id: uuid.UUID, battlegroup: int, fmt: SeasonFormat, name: str
    ) -> None:
        await assert_name_free(
            session, DefensePlan, name, PLAN_NAME_TAKEN, *_scope(alliance_id, battlegroup, fmt)
        )

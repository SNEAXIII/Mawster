import uuid
from collections import Counter

from fastapi import HTTPException
from sqlalchemy.orm import selectinload
from sqlmodel import select
from starlette import status

from src.Messages.defense_messages import (
    CHAMPION_NOT_FOUND_IN_ROSTER,
    CHAMPION_USER_MISMATCH,
    NO_CHAMPION_ON_NODE,
    PLAYER_NOT_IN_ALLIANCE,
    PLAYER_NOT_IN_BATTLEGROUP,
    player_max_defenders_reached,
)
from src.models.alliance.Alliance import Alliance
from src.models.alliance.AllianceOfficer import AllianceOfficer
from src.models.alliance.AllianceStrategist import AllianceStrategist
from src.models.alliance.DefensePlan import DefensePlan, DefensePlanNode
from src.models.champion.ChampionUser import ChampionUser
from src.models.user.GameAccount import GameAccount
from src.services.admin.SagaService import SagaService
from src.services.admin.SeasonService import SeasonService
from src.services.alliance.defense._rules import (
    assert_champion_exists,
    assert_champion_free,
    assert_node_on_map,
    bg_members,
)
from src.services.alliance.defense.DefensePlanService import DefensePlanService
from src.services.alliance.war.WarFormatConfig import for_format
from src.utils.db import SessionDep


def _held(plan: DefensePlan | None, skip_node: int | None = None) -> Counter[uuid.UUID]:
    """game_account_id → nodes held in this plan, the node being edited left out."""
    if plan is None:
        return Counter()
    return Counter(
        n.champion_user.game_account_id
        for n in plan.nodes
        if n.champion_user is not None and n.node_number != skip_node
    )


class DefensePlanNodeService:
    @classmethod
    async def set_node(
        cls,
        session: SessionDep,
        plan: DefensePlan,
        node_number: int,
        champion_id: uuid.UUID | None,
        champion_user_id: uuid.UUID | None,
        placed_by_id: uuid.UUID | None,
    ) -> DefensePlan:
        assert_node_on_map(plan.format, node_number)
        if champion_user_id is not None:
            champion_id = await cls._assert_assignable(
                session, plan, node_number, champion_id, champion_user_id
            )
        else:
            await assert_champion_exists(session, champion_id)
        assert_champion_free(plan.nodes, champion_id, node_number)
        node = next((n for n in plan.nodes if n.node_number == node_number), None)
        if node is None:
            node = DefensePlanNode(plan_id=plan.id, node_number=node_number)
        node.champion_id = champion_id
        node.champion_user_id = champion_user_id
        node.placed_by_id = placed_by_id
        session.add(node)
        await session.commit()
        return await DefensePlanService.get_plan(session, plan.alliance_id, plan.id)

    @staticmethod
    async def _assert_assignable(
        session: SessionDep,
        plan: DefensePlan,
        node_number: int,
        champion_id: uuid.UUID | None,
        champion_user_id: uuid.UUID,
    ) -> uuid.UUID:
        """Validate the roster entry for this node; returns the Champion it places."""
        copy = await session.get(ChampionUser, champion_user_id)
        if copy is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, CHAMPION_NOT_FOUND_IN_ROSTER)
        if champion_id is not None and copy.champion_id != champion_id:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, CHAMPION_USER_MISMATCH)
        account = await session.get(GameAccount, copy.game_account_id)
        if account is None or account.alliance_id != plan.alliance_id:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, PLAYER_NOT_IN_ALLIANCE)
        if account.alliance_group != plan.battlegroup:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, PLAYER_NOT_IN_BATTLEGROUP)
        cap = for_format(plan.format).max_defenders_per_player
        if _held(plan, node_number)[account.id] >= cap:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, player_max_defenders_reached(cap))
        return copy.champion_id

    @staticmethod
    async def remove_node(session: SessionDep, plan: DefensePlan, node_number: int) -> None:
        node = next((n for n in plan.nodes if n.node_number == node_number), None)
        if node is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, NO_CHAMPION_ON_NODE)
        await session.delete(node)
        await session.commit()

    @staticmethod
    async def clear_plan(session: SessionDep, plan: DefensePlan) -> None:
        for node in list(plan.nodes):
            await session.delete(node)
        await session.commit()

    @classmethod
    async def available_champions(
        cls, session: SessionDep, plan: DefensePlan, node_number: int | None
    ) -> list[dict]:
        """BG members' champions not on another node, grouped by champion, best owner first."""
        members = await bg_members(session, plan.alliance_id, plan.battlegroup)
        if not members:
            return []
        member_map = {m.id: m for m in members}
        roster = (
            await session.exec(
                select(ChampionUser)
                .where(ChampionUser.game_account_id.in_(member_map))  # type: ignore[attr-defined]
                .options(selectinload(ChampionUser.champion))  # type: ignore[arg-type]
            )
        ).all()
        taken = {n.champion_id for n in plan.nodes if n.node_number != node_number}
        held = _held(plan, node_number)
        cap = for_format(plan.format).max_defenders_per_player
        saga = await SagaService.resolve_current(session)

        groups: dict[uuid.UUID, dict] = {}
        for cu in roster:
            if cu.champion_id in taken or held[cu.game_account_id] >= cap:
                continue
            if cu.champion_id not in groups:
                is_saga_attacker, is_saga_defender = saga.get(cu.champion_id, (False, False))
                groups[cu.champion_id] = {
                    "champion_id": str(cu.champion_id),
                    "champion_name": cu.champion.name,
                    "champion_alias": cu.champion.alias,
                    "champion_class": cu.champion.champion_class,
                    "is_saga_attacker": is_saga_attacker,
                    "is_saga_defender": is_saga_defender,
                    "image_url": cu.champion.image_url,
                    "owners": [],
                }
            groups[cu.champion_id]["owners"].append(
                {
                    "champion_user_id": str(cu.id),
                    "game_account_id": str(cu.game_account_id),
                    "game_pseudo": member_map[cu.game_account_id].game_pseudo,
                    "rarity": cu.rarity,
                    "stars": cu.stars,
                    "rank": cu.rank,
                    "signature": cu.signature,
                    "is_preferred_attacker": cu.is_preferred_attacker,
                    "ascension": cu.ascension,
                    "defender_count": held[cu.game_account_id],
                }
            )
        for group in groups.values():
            group["owners"].sort(key=lambda o: (-o["stars"], -o["rank"], o["defender_count"]))
        return sorted(groups.values(), key=lambda g: g["champion_name"])

    @classmethod
    async def members_with_counts(
        cls,
        session: SessionDep,
        alliance_id: uuid.UUID,
        battlegroup: int,
        plan: DefensePlan | None,
    ) -> list[dict]:
        members = await bg_members(session, alliance_id, battlegroup)
        held = _held(plan)
        fmt = plan.format if plan else await SeasonService.get_current_format(session)
        alliance = await session.get(Alliance, alliance_id)
        owner_id = alliance.owner_id if alliance else None

        async def rank_ids(model: type[AllianceOfficer] | type[AllianceStrategist]) -> set:
            result = await session.exec(
                select(model.game_account_id).where(model.alliance_id == alliance_id)
            )
            return set(result.all())

        officer_ids = await rank_ids(AllianceOfficer)
        strategist_ids = await rank_ids(AllianceStrategist)
        return [
            {
                "game_account_id": str(m.id),
                "game_pseudo": m.game_pseudo,
                "defender_count": held[m.id],
                "max_defenders": for_format(fmt).max_defenders_per_player,
                "is_owner": m.id == owner_id,
                "is_officer": m.id in officer_ids,
                "is_strategist": m.id in strategist_ids,
            }
            for m in members
        ]

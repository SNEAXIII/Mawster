"""Checks shared by Defense Templates and Defense Plans."""

import uuid
from collections.abc import Iterable
from typing import Any, Protocol

from fastapi import HTTPException
from sqlmodel import func, select
from starlette import status

from src.enums.SeasonFormat import SeasonFormat
from src.Messages.defense_messages import (
    CHAMPION_ALREADY_PLACED_OTHER_NODE,
    CHAMPION_NOT_FOUND,
    node_exceeds_map,
)
from src.models.champion.Champion import Champion
from src.models.user.GameAccount import GameAccount
from src.services.alliance.war.WarFormatConfig import for_format
from src.utils.db import SessionDep


class _Node(Protocol):
    node_number: int
    champion_id: uuid.UUID


def assert_node_on_map(fmt: SeasonFormat, node_number: int) -> None:
    node_count = for_format(fmt).node_count
    if not 1 <= node_number <= node_count:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, node_exceeds_map(node_count))


def assert_champion_free(nodes: Iterable[_Node], champion_id: uuid.UUID, node_number: int) -> None:
    if any(n.champion_id == champion_id and n.node_number != node_number for n in nodes):
        raise HTTPException(status.HTTP_409_CONFLICT, CHAMPION_ALREADY_PLACED_OTHER_NODE)


async def assert_champion_exists(session: SessionDep, champion_id: uuid.UUID) -> None:
    if await session.get(Champion, champion_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, CHAMPION_NOT_FOUND)


async def count_rows(session: SessionDep, model: Any, *filters: Any) -> int:
    return (await session.exec(select(func.count(model.id)).where(*filters))).one()


async def assert_name_free(
    session: SessionDep, model: Any, name: str, message: str, *filters: Any
) -> None:
    if await count_rows(session, model, model.name == name, *filters):
        raise HTTPException(status.HTTP_409_CONFLICT, message)


async def bg_members(
    session: SessionDep, alliance_id: uuid.UUID, battlegroup: int
) -> list[GameAccount]:
    result = await session.exec(
        select(GameAccount).where(
            GameAccount.alliance_id == alliance_id, GameAccount.alliance_group == battlegroup
        )
    )
    return list(result.all())

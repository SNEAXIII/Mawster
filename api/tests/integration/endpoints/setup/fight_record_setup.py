"""Snapshotted fights for tests: a placement on the war map and the record freezing it."""

import uuid

from sqlmodel import func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.enums.WarStatus import WarStatus
from src.models.Base import utcnow
from src.models.champion.Champion import Champion
from src.models.champion.ChampionUser import ChampionUser
from src.models.war.War import War
from src.models.war.WarDefensePlacement import WarDefensePlacement
from src.models.war.WarFightRecord import WarFightRecord
from tests.utils.utils_db import load_objects, sqlite_async_engine


async def push_ended_war(
    alliance_id: uuid.UUID,
    created_by_id: uuid.UUID,
    *,
    season_id: uuid.UUID | None = None,
    tier: int = 1,
) -> War:
    """A war already closed and snapshotted, carrying the season and tier its fights read."""
    war = War(
        id=uuid.uuid4(),
        alliance_id=alliance_id,
        opponent_name="Enemy",
        created_by_id=created_by_id,
        season_id=season_id,
        tier=tier,
        status=WarStatus.ended,
        snapshotted_at=utcnow(),
    )
    await load_objects([war])
    return war


async def _next_free_node(war_id: uuid.UUID, battlegroup: int) -> int:
    async with AsyncSession(sqlite_async_engine) as session:
        highest = (
            await session.exec(
                select(func.max(WarDefensePlacement.node_number)).where(
                    WarDefensePlacement.war_id == war_id,
                    WarDefensePlacement.battlegroup == battlegroup,
                )
            )
        ).one()
    return (highest or 0) + 1


async def push_fight_record(
    war: War,
    attacker_cu: ChampionUser,
    defender_champion: Champion,
    *,
    battlegroup: int = 1,
    node_number: int | None = None,
    ko_count: int = 0,
    is_planning_error: bool = False,
) -> WarFightRecord:
    """One fought node of `war` and its record; the node defaults to the next free one."""
    if node_number is None:
        node_number = await _next_free_node(war.id, battlegroup)
    placement = WarDefensePlacement(
        war_id=war.id,
        battlegroup=battlegroup,
        node_number=node_number,
        champion_id=defender_champion.id,
        stars=6,
        rank=3,
        ascension=0,
        attacker_champion_user_id=attacker_cu.id,
        ko_count=ko_count,
        is_planning_error=is_planning_error,
    )
    record = WarFightRecord(
        war_defense_placement_id=placement.id,
        rank=attacker_cu.rank,
        ascension=attacker_cu.ascension,
    )
    await load_objects([placement])
    await load_objects([record])
    return record

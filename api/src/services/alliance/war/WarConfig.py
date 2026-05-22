from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from src.models.War import War
    from src.utils.db import SessionDep


class WarType(str, Enum):
    normal = "normal"
    big_thing = "big_thing"


@dataclass(frozen=True)
class WarConfig:
    war_type: WarType
    max_attackers_per_player: int
    max_nodes: int
    node_range: tuple[int, int]


NORMAL_WAR_CONFIG = WarConfig(
    war_type=WarType.normal,
    max_attackers_per_player=3,
    max_nodes=50,
    node_range=(1, 50),
)

BIG_THING_CONFIG = WarConfig(
    war_type=WarType.big_thing,
    max_attackers_per_player=2,
    max_nodes=10,
    node_range=(1, 10),
)


async def resolve_war_config(war: "War", session: "SessionDep") -> WarConfig:
    from src.models.Season import Season
    from src.services.admin.AppConfigService import AppConfigService

    if war.season_id is not None:
        season = await session.get(Season, war.season_id)
        if season and season.is_big_thing:
            return BIG_THING_CONFIG
        return NORMAL_WAR_CONFIG

    is_big = await AppConfigService.get_off_season_big_thing(session)
    return BIG_THING_CONFIG if is_big else NORMAL_WAR_CONFIG

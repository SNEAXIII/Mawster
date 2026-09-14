"""The one join path from a Fight Record to the war data it no longer copies."""

from sqlalchemy import Integer, and_, cast, func
from sqlalchemy.sql import Select
from sqlmodel import select

from src.models.champion.Champion import Champion
from src.models.champion.ChampionUser import ChampionUser
from src.models.war.War import War
from src.models.war.WarDefensePlacement import WarDefensePlacement
from src.models.war.WarFightRecord import WarFightRecord


def join_fight_context[S](stmt: S) -> S:
    """Join a statement to each record's placement, war and attacker's roster entry.

    Inner join on the attacker: a placement that lost its attacker drops out of every read.
    """
    return (
        stmt.select_from(WarFightRecord)
        .join(
            WarDefensePlacement,
            WarFightRecord.war_defense_placement_id == WarDefensePlacement.id,
        )
        .join(War, WarDefensePlacement.war_id == War.id)
        .join(ChampionUser, WarDefensePlacement.attacker_champion_user_id == ChampionUser.id)
        .where(WarDefensePlacement.is_fight_not_done.is_(False))
    )


def champion_usage_statement(perspective: str, conditions: list) -> Select:
    """Champion usage rows (id, name, image, fight count, total KOs) from one perspective."""
    if perspective == "defender":
        champion_id_col = WarDefensePlacement.champion_id.label("champion_id")
        group_by_col = WarDefensePlacement.champion_id
    else:
        champion_id_col = ChampionUser.champion_id.label("champion_id")
        group_by_col = ChampionUser.champion_id

    return (
        join_fight_context(
            select(
                champion_id_col,
                Champion.name.label("champion_name"),
                Champion.image_url,
                cast(func.count(WarFightRecord.id), Integer).label("fight_count"),
                cast(func.sum(WarDefensePlacement.ko_count), Integer).label("total_kos"),
            )
        )
        .join(Champion, Champion.id == group_by_col)
        .where(and_(*conditions))
        .group_by(group_by_col, Champion.name, Champion.image_url)
        .order_by(func.count(WarFightRecord.id).desc())
    )

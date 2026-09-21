"""The one join path from a Fight Record to the war data it no longer copies."""

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

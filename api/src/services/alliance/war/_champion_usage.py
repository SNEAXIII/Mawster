"""Champion usage query shared by the alliance and player stats."""

from sqlalchemy import Integer, Select, and_, cast, func
from sqlmodel import select

from src.models.champion.Champion import Champion
from src.models.champion.ChampionUser import ChampionUser
from src.models.war.WarDefensePlacement import WarDefensePlacement
from src.models.war.WarFightRecord import WarFightRecord
from src.services.knowledge._fight_context import join_fight_context


def champion_usage_statement(conditions: list, deathless: bool | None, perspective: str) -> Select:
    """Fights and KOs per champion: the one used (`attacker`) or the one faced (`defender`)."""
    if deathless is True:
        conditions = [*conditions, WarDefensePlacement.ko_count == 0]

    if perspective == "defender":
        group_by_col = WarDefensePlacement.champion_id
    else:
        group_by_col = ChampionUser.champion_id

    return (
        join_fight_context(
            select(
                group_by_col.label("champion_id"),
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

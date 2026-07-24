import uuid

from sqlalchemy.orm import selectinload
from sqlalchemy.sql.expression import Select
from sqlmodel import and_, or_, select

from src.models.Champion import Champion
from src.models.ChampionUser import ChampionUser
from src.models.GameAccount import GameAccount
from src.utils.db import SessionDep


class AllianceRosterService:
    @classmethod
    def _apply_filters(
        cls,
        stmt: Select,
        *,
        alliance_id: uuid.UUID,
        name: str | None,
        champion_class: str | None,
        ranks: list[str] | None,
        ascensions: list[int] | None,
        preferred_attacker: bool,
        alliance_group: int | None,
        no_group: bool,
        saga_attacker_ids: set[uuid.UUID] | None,
        saga_defender_ids: set[uuid.UUID] | None,
    ) -> Select:
        """Apply the champion-search filters at the instance level."""
        stmt = (
            stmt.join(GameAccount, ChampionUser.game_account_id == GameAccount.id)
            .join(Champion, ChampionUser.champion_id == Champion.id)
            .where(GameAccount.alliance_id == alliance_id)
        )

        if name:
            like = f"%{name.strip()}%"
            stmt = stmt.where(or_(Champion.name.ilike(like), Champion.alias.ilike(like)))
        if champion_class:
            stmt = stmt.where(Champion.champion_class == champion_class)
        if ranks:
            pairs = []
            for code in ranks:
                stars_str, _, rank_str = code.partition("r")
                if stars_str.isdigit() and rank_str.isdigit():
                    pairs.append(
                        and_(
                            ChampionUser.stars == int(stars_str),
                            ChampionUser.rank == int(rank_str),
                        )
                    )
            if pairs:
                stmt = stmt.where(or_(*pairs))
        if ascensions:
            stmt = stmt.where(ChampionUser.ascension.in_(ascensions))
        if preferred_attacker:
            stmt = stmt.where(ChampionUser.is_preferred_attacker.is_(True))
        if no_group:
            stmt = stmt.where(GameAccount.alliance_group.is_(None))
        elif alliance_group is not None:
            stmt = stmt.where(GameAccount.alliance_group == alliance_group)
        if saga_attacker_ids is not None:
            stmt = stmt.where(ChampionUser.champion_id.in_(saga_attacker_ids))
        if saga_defender_ids is not None:
            stmt = stmt.where(ChampionUser.champion_id.in_(saga_defender_ids))
        return stmt

    @classmethod
    async def get_alliance_roster(
        cls,
        session: SessionDep,
        alliance_id: uuid.UUID,
        *,
        name: str | None = None,
        champion_class: str | None = None,
        ranks: list[str] | None = None,
        ascensions: list[int] | None = None,
        preferred_attacker: bool = False,
        alliance_group: int | None = None,
        no_group: bool = False,
        saga_attacker_ids: set[uuid.UUID] | None = None,
        saga_defender_ids: set[uuid.UUID] | None = None,
        distinct_champion_limit: int | None = None,
    ) -> list[ChampionUser]:
        """Return alliance-wide champion entries, optionally filtered.

        Filters apply at the instance level (only matching instances are returned).
        When `distinct_champion_limit` is set, the result is capped to that many
        distinct champions — the first N alphabetically by name — with every
        matching instance of those champions.
        """
        filter_kwargs = {
            "alliance_id": alliance_id,
            "name": name,
            "champion_class": champion_class,
            "ranks": ranks,
            "ascensions": ascensions,
            "preferred_attacker": preferred_attacker,
            "alliance_group": alliance_group,
            "no_group": no_group,
            "saga_attacker_ids": saga_attacker_ids,
            "saga_defender_ids": saga_defender_ids,
        }

        stmt = cls._apply_filters(select(ChampionUser), **filter_kwargs)

        if distinct_champion_limit is not None:
            distinct_ids = cls._apply_filters(select(ChampionUser.champion_id), **filter_kwargs)
            distinct_ids = (
                distinct_ids.group_by(ChampionUser.champion_id, Champion.name)
                .order_by(Champion.name)
                .limit(distinct_champion_limit)
            )
            # Wrap the limited select in a derived table: MariaDB rejects LIMIT
            # directly inside an IN (...) subquery, but allows it in a FROM subquery.
            capped = distinct_ids.subquery()
            stmt = stmt.where(ChampionUser.champion_id.in_(select(capped.c.champion_id)))

        stmt = stmt.options(
            selectinload(ChampionUser.champion),  # type: ignore[arg-type]
            selectinload(ChampionUser.game_account),  # type: ignore[arg-type]
        ).order_by(Champion.name)

        result = await session.exec(stmt)
        return result.all()

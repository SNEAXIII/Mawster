import uuid
from typing import Any

from sqlalchemy import and_, func
from sqlmodel import or_, select

from src.dto.admin.dto_champion import (
    ChampionFilters,
    ChampionLoadRequest,
    ChampionPaginatedResponse,
    ChampionResponse,
)
from src.enums.ChampionClass import ChampionClass
from src.Messages.champion_messages import (
    CHAMPION_NOT_FOUND,
)
from src.models.champion.Champion import Champion
from src.models.champion.ChampionSagaRole import ChampionSagaRole
from src.utils.db import SessionDep

VALID_CLASSES = {c.value for c in ChampionClass}


class ChampionService:
    @classmethod
    async def get_champion_by_id(cls, session: SessionDep, champion_id: uuid.UUID) -> Champion:
        champion = await session.get(Champion, champion_id)
        if champion is None:
            raise CHAMPION_NOT_FOUND
        return champion

    @classmethod
    async def get_champion_by_name(cls, session: SessionDep, name: str) -> Champion | None:
        sql = select(Champion).where(Champion.name == name)
        result = await session.exec(sql)
        return result.first()

    @classmethod
    def _saga_attacker_col(cls) -> Any:
        return func.coalesce(ChampionSagaRole.is_saga_attacker, False)

    @classmethod
    def _saga_defender_col(cls) -> Any:
        return func.coalesce(ChampionSagaRole.is_saga_defender, False)

    @classmethod
    def _apply_filters(cls, sql: Any, filters: ChampionFilters) -> Any:
        if filters.needs_saga_join:
            # Outer, so champions with no role row for the season stay visible and
            # count as "not attacker, not defender" rather than vanishing.
            sql = sql.outerjoin(
                ChampionSagaRole,
                and_(
                    ChampionSagaRole.champion_id == Champion.id,
                    ChampionSagaRole.season_id == filters.season_id,
                ),
            )
        if filters.champion_class:
            sql = sql.where(Champion.champion_class == filters.champion_class)
        if filters.search:
            like_pattern = f"%{filters.search}%"
            sql = sql.where(
                or_(
                    Champion.name.ilike(like_pattern),
                    Champion.alias.ilike(like_pattern),
                )
            )
        if filters.is_7_stars_available is not None:
            sql = sql.where(Champion.is_7_stars_available == filters.is_7_stars_available)
        if filters.is_ascendable is not None:
            sql = sql.where(Champion.is_ascendable == filters.is_ascendable)
        if filters.has_prefight is not None:
            sql = sql.where(Champion.has_prefight == filters.has_prefight)
        if filters.is_saga_attacker is not None:
            sql = sql.where(cls._saga_attacker_col() == filters.is_saga_attacker)
        if filters.is_saga_defender is not None:
            sql = sql.where(cls._saga_defender_col() == filters.is_saga_defender)
        return sql

    @classmethod
    def _apply_ordering(cls, sql: Any, filters: ChampionFilters) -> Any:
        column = getattr(Champion, filters.order_by)
        primary = column.desc() if filters.order_dir == "desc" else column.asc()
        if filters.order_by == "name":
            return sql.order_by(primary)
        # Class is not unique, so name breaks the tie and keeps pagination stable.
        return sql.order_by(primary, Champion.name.asc())

    @classmethod
    async def get_total_champions(
        cls,
        session: SessionDep,
        filters: ChampionFilters | None = None,
    ) -> int:
        sql = select(func.count()).select_from(Champion)
        sql = cls._apply_filters(sql, filters or ChampionFilters())
        result = await session.exec(sql)
        return result.one()

    @classmethod
    async def get_champions_paginated(
        cls,
        session: SessionDep,
        page: int,
        size: int,
        filters: ChampionFilters | None = None,
    ) -> list[ChampionResponse]:
        filters = filters or ChampionFilters()
        if filters.needs_saga_join:
            sql = select(Champion, cls._saga_attacker_col(), cls._saga_defender_col())
        else:
            sql = select(Champion)
        sql = cls._apply_filters(sql, filters)
        sql = cls._apply_ordering(sql, filters)
        sql = sql.offset((page - 1) * size).limit(size)
        result = await session.exec(sql)

        if not filters.needs_saga_join:
            return [ChampionResponse.model_validate(c) for c in result.all()]
        return [
            ChampionResponse.model_validate(champion).model_copy(
                update={"is_saga_attacker": bool(attacker), "is_saga_defender": bool(defender)}
            )
            for champion, attacker, defender in result.all()
        ]

    @classmethod
    async def get_champions_with_pagination(
        cls,
        session: SessionDep,
        page: int,
        size: int,
        filters: ChampionFilters | None = None,
    ) -> ChampionPaginatedResponse:
        filters = filters or ChampionFilters()
        total = await cls.get_total_champions(session, filters)
        champions = await cls.get_champions_paginated(session, page, size, filters)
        total_pages = (total + size - 1) // size
        return ChampionPaginatedResponse(
            champions=champions,
            total_champions=total,
            total_pages=total_pages,
            current_page=page,
        )

    @classmethod
    async def update_alias(
        cls, session: SessionDep, champion_id: uuid.UUID, alias: str | None
    ) -> Champion:
        champion = await cls.get_champion_by_id(session, champion_id)
        champion.alias = alias
        session.add(champion)
        await session.commit()
        await session.refresh(champion)
        return champion

    @classmethod
    async def toggle_ascendable(cls, session: SessionDep, champion_id: uuid.UUID) -> Champion:
        champion = await cls.get_champion_by_id(session, champion_id)
        champion.is_ascendable = not champion.is_ascendable
        session.add(champion)
        await session.commit()
        await session.refresh(champion)
        return champion

    @classmethod
    async def toggle_seven_stars(cls, session: SessionDep, champion_id: uuid.UUID) -> Champion:
        champion = await cls.get_champion_by_id(session, champion_id)
        champion.is_7_stars_available = not champion.is_7_stars_available
        session.add(champion)
        await session.commit()
        await session.refresh(champion)
        return champion

    @classmethod
    async def toggle_prefight(cls, session: SessionDep, champion_id: uuid.UUID) -> Champion:
        champion = await cls.get_champion_by_id(session, champion_id)
        champion.has_prefight = not champion.has_prefight
        session.add(champion)
        await session.commit()
        await session.refresh(champion)
        return champion

    @classmethod
    async def load_champions(
        cls, session: SessionDep, champions_data: list[ChampionLoadRequest]
    ) -> dict:
        """Load/update champions from a list. Upsert by name."""
        created = 0
        updated = 0
        skipped = 0

        for data in champions_data:
            if data.champion_class not in VALID_CLASSES:
                skipped += 1
                continue

            existing = await cls.get_champion_by_name(session, data.name)

            if existing:
                existing.champion_class = data.champion_class
                if data.image_url:
                    existing.image_url = data.image_url
                if data.alias is not None:
                    existing.alias = data.alias
                if data.is_7_stars_available is not None:
                    existing.is_7_stars_available = data.is_7_stars_available
                if data.is_ascendable is not None:
                    existing.is_ascendable = data.is_ascendable
                if data.has_prefight is not None:
                    existing.has_prefight = data.has_prefight
                session.add(existing)
                updated += 1
            else:
                new_champion = Champion(
                    name=data.name,
                    champion_class=data.champion_class,
                    image_url=data.image_url,
                    alias=data.alias,
                    is_ascendable=data.is_ascendable or False,
                    has_prefight=data.has_prefight or False,
                )
                # Left to the model default when the import is silent, so the upcoming
                # default flip reaches imported champions too.
                if data.is_7_stars_available is not None:
                    new_champion.is_7_stars_available = data.is_7_stars_available
                session.add(new_champion)
                created += 1

        await session.commit()
        return {"created": created, "updated": updated, "skipped": skipped}

    @classmethod
    async def delete_champion(cls, session: SessionDep, champion_id: uuid.UUID) -> None:
        champion = await cls.get_champion_by_id(session, champion_id)
        await session.delete(champion)
        await session.commit()

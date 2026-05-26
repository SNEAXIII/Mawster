import uuid
from typing import Any, Optional

from sqlalchemy import func
from sqlmodel import select, or_

from src.Messages.champion_messages import (
    CHAMPION_NOT_FOUND,
)
from src.dto.admin.dto_champion import (
    ChampionPaginatedResponse,
    ChampionResponse,
    ChampionLoadRequest,
)
from src.enums.ChampionClass import ChampionClass
from src.models.Champion import Champion
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
    async def get_champion_by_name(cls, session: SessionDep, name: str) -> Optional[Champion]:
        sql = select(Champion).where(Champion.name == name)
        result = await session.exec(sql)
        return result.first()

    @classmethod
    def _apply_filters(
        cls,
        sql: Any,
        champion_class: Optional[str] = None,
        search: Optional[str] = None,
        is_ascendable: Optional[bool] = None,
        has_prefight: Optional[bool] = None,
        is_saga_attacker: Optional[bool] = None,
        is_saga_defender: Optional[bool] = None,
    ) -> Any:
        if champion_class:
            sql = sql.where(Champion.champion_class == champion_class)
        if search:
            like_pattern = f"%{search}%"
            sql = sql.where(
                or_(
                    Champion.name.ilike(like_pattern),
                    Champion.alias.ilike(like_pattern),
                )
            )
        if is_ascendable is not None:
            sql = sql.where(Champion.is_ascendable == is_ascendable)
        if has_prefight is not None:
            sql = sql.where(Champion.has_prefight == has_prefight)
        if is_saga_attacker is not None:
            sql = sql.where(Champion.is_saga_attacker == is_saga_attacker)
        if is_saga_defender is not None:
            sql = sql.where(Champion.is_saga_defender == is_saga_defender)
        return sql

    @classmethod
    async def get_total_champions(
        cls,
        session: SessionDep,
        champion_class: Optional[str] = None,
        search: Optional[str] = None,
        is_ascendable: Optional[bool] = None,
        has_prefight: Optional[bool] = None,
        is_saga_attacker: Optional[bool] = None,
        is_saga_defender: Optional[bool] = None,
    ) -> int:
        sql = select(func.count()).select_from(Champion)
        sql = cls._apply_filters(
            sql,
            champion_class,
            search,
            is_ascendable,
            has_prefight,
            is_saga_attacker,
            is_saga_defender,
        )
        result = await session.exec(sql)
        return result.one()

    @classmethod
    async def get_champions_paginated(
        cls,
        session: SessionDep,
        page: int,
        size: int,
        champion_class: Optional[str] = None,
        search: Optional[str] = None,
        is_ascendable: Optional[bool] = None,
        has_prefight: Optional[bool] = None,
        is_saga_attacker: Optional[bool] = None,
        is_saga_defender: Optional[bool] = None,
    ) -> list[Champion]:
        sql = select(Champion).order_by(Champion.name)
        sql = cls._apply_filters(
            sql,
            champion_class,
            search,
            is_ascendable,
            has_prefight,
            is_saga_attacker,
            is_saga_defender,
        )
        offset = (page - 1) * size
        sql = sql.offset(offset).limit(size)
        result = await session.exec(sql)
        return list(result.all())

    @classmethod
    async def get_champions_with_pagination(
        cls,
        session: SessionDep,
        page: int,
        size: int,
        champion_class: Optional[str] = None,
        search: Optional[str] = None,
        is_ascendable: Optional[bool] = None,
        has_prefight: Optional[bool] = None,
        is_saga_attacker: Optional[bool] = None,
        is_saga_defender: Optional[bool] = None,
    ) -> ChampionPaginatedResponse:
        total = await cls.get_total_champions(
            session,
            champion_class,
            search,
            is_ascendable,
            has_prefight,
            is_saga_attacker,
            is_saga_defender,
        )
        champions = await cls.get_champions_paginated(
            session,
            page,
            size,
            champion_class,
            search,
            is_ascendable,
            has_prefight,
            is_saga_attacker,
            is_saga_defender,
        )
        total_pages = (total + size - 1) // size
        mapped = [ChampionResponse.model_validate(c) for c in champions]
        return ChampionPaginatedResponse(
            champions=mapped,
            total_champions=total,
            total_pages=total_pages,
            current_page=page,
        )

    @classmethod
    async def update_alias(
        cls, session: SessionDep, champion_id: uuid.UUID, alias: Optional[str]
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
    async def toggle_prefight(cls, session: SessionDep, champion_id: uuid.UUID) -> Champion:
        champion = await cls.get_champion_by_id(session, champion_id)
        champion.has_prefight = not champion.has_prefight
        session.add(champion)
        await session.commit()
        await session.refresh(champion)
        return champion

    @classmethod
    async def toggle_saga_attacker(cls, session: SessionDep, champion_id: uuid.UUID) -> Champion:
        champion = await cls.get_champion_by_id(session, champion_id)
        champion.is_saga_attacker = not champion.is_saga_attacker
        session.add(champion)
        await session.commit()
        await session.refresh(champion)
        return champion

    @classmethod
    async def toggle_saga_defender(cls, session: SessionDep, champion_id: uuid.UUID) -> Champion:
        champion = await cls.get_champion_by_id(session, champion_id)
        champion.is_saga_defender = not champion.is_saga_defender
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
                if data.is_ascendable is not None:
                    existing.is_ascendable = data.is_ascendable
                if data.has_prefight is not None:
                    existing.has_prefight = data.has_prefight
                if data.is_saga_attacker is not None:
                    existing.is_saga_attacker = data.is_saga_attacker
                if data.is_saga_defender is not None:
                    existing.is_saga_defender = data.is_saga_defender
                session.add(existing)
                updated += 1
            else:
                new_champion = Champion(
                    name=data.name,
                    champion_class=data.champion_class,
                    image_url=data.image_url,
                    alias=data.alias,
                    is_7_star=False,
                    is_ascendable=data.is_ascendable or False,
                    has_prefight=data.has_prefight or False,
                    is_saga_attacker=data.is_saga_attacker or False,
                    is_saga_defender=data.is_saga_defender or False,
                )
                session.add(new_champion)
                created += 1

        await session.commit()
        return {"created": created, "updated": updated, "skipped": skipped}

    @classmethod
    async def delete_champion(cls, session: SessionDep, champion_id: uuid.UUID) -> None:
        champion = await cls.get_champion_by_id(session, champion_id)
        await session.delete(champion)
        await session.commit()

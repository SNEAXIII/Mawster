import uuid
from typing import Optional

from sqlalchemy import func
from sqlmodel import select, or_

from src.Messages.champion_messages import (
    CHAMPION_NOT_FOUND,
)
from src.dto.dto_champion import (
    ChampionAdminViewAll,
    ChampionResponse,
    ChampionLoadRequest,
)
from src.enums.ChampionClass import ChampionClass
from src.models.Champion import Champion
from src.utils.db import SessionDep


VALID_CLASSES = {c.value for c in ChampionClass}


class ChampionService:

    @classmethod
    async def get_champion_by_id(
        cls, session: SessionDep, champion_id: uuid.UUID
    ) -> Champion:
        champion = await session.get(Champion, champion_id)
        if champion is None:
            raise CHAMPION_NOT_FOUND
        return champion

    @classmethod
    async def get_champion_by_name(
        cls, session: SessionDep, name: str
    ) -> Optional[Champion]:
        sql = select(Champion).where(Champion.name == name)
        result = await session.exec(sql)
        return result.first()

    @classmethod
    async def get_total_champions(
        cls,
        session: SessionDep,
        champion_class: Optional[str] = None,
        search: Optional[str] = None,
    ) -> int:
        sql = select(func.count()).select_from(Champion)
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
    ) -> list[Champion]:
        sql = select(Champion).order_by(Champion.name)
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
    ) -> ChampionAdminViewAll:
        total = await cls.get_total_champions(session, champion_class, search)
        champions = await cls.get_champions_paginated(
            session, page, size, champion_class, search
        )
        total_pages = (total + size - 1) // size
        mapped = [
            ChampionResponse(
                id=c.id,
                name=c.name,
                champion_class=c.champion_class,
                image_url=c.image_url,
                is_7_star=c.is_7_star,
                alias=c.alias,
            )
            for c in champions
        ]
        return ChampionAdminViewAll(
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
                session.add(existing)
                updated += 1
            else:
                new_champion = Champion(
                    name=data.name,
                    champion_class=data.champion_class,
                    image_url=data.image_url,
                    is_7_star=False,
                )
                session.add(new_champion)
                created += 1

        await session.commit()
        return {"created": created, "updated": updated, "skipped": skipped}

    @classmethod
    async def delete_champion(
        cls, session: SessionDep, champion_id: uuid.UUID
    ) -> None:
        champion = await cls.get_champion_by_id(session, champion_id)
        await session.delete(champion)
        await session.commit()

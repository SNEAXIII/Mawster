import uuid

from sqlmodel import select

from src.models.ChampionSagaRole import ChampionSagaRole
from src.services.admin.SeasonService import SeasonService
from src.utils.db import SessionDep


class SagaService:
    @classmethod
    async def get_roles_for_season(
        cls, session: SessionDep, season_id: uuid.UUID
    ) -> dict[uuid.UUID, tuple[bool, bool]]:
        result = await session.exec(
            select(ChampionSagaRole).where(ChampionSagaRole.season_id == season_id)
        )
        return {r.champion_id: (r.is_saga_attacker, r.is_saga_defender) for r in result.all()}

    @classmethod
    async def resolve_current(cls, session: SessionDep) -> dict[uuid.UUID, tuple[bool, bool]]:
        season = await SeasonService.get_current_season(session)
        if season is None:
            return {}
        return await cls.get_roles_for_season(session, season.id)

    @classmethod
    async def upsert_role(
        cls,
        session: SessionDep,
        season_id: uuid.UUID,
        champion_id: uuid.UUID,
        is_saga_attacker: bool,
        is_saga_defender: bool,
    ) -> ChampionSagaRole:
        result = await session.exec(
            select(ChampionSagaRole).where(
                ChampionSagaRole.season_id == season_id,
                ChampionSagaRole.champion_id == champion_id,
            )
        )
        role = result.first()
        if role is None:
            role = ChampionSagaRole(season_id=season_id, champion_id=champion_id)
        role.is_saga_attacker = is_saga_attacker
        role.is_saga_defender = is_saga_defender
        session.add(role)
        await session.commit()
        await session.refresh(role)
        return role

import uuid
from typing import Optional

from fastapi import HTTPException
from sqlmodel import select, and_
from sqlalchemy.orm import selectinload
from starlette import status

from src.models.Champion import Champion
from src.models.War import War
from src.models.WarDefensePlacement import WarDefensePlacement
from src.dto.dto_war import WarCreateRequest, WarResponse, WarPlacementCreateRequest, WarPlacementResponse, WarDefenseSummaryResponse
from src.utils.db import SessionDep


class WarService:

    @classmethod
    async def create_war(
        cls,
        session: SessionDep,
        alliance_id: uuid.UUID,
        opponent_name: str,
        created_by_id: uuid.UUID,
    ) -> WarResponse:
        existing = await session.exec(
            select(War).where(War.alliance_id == alliance_id, War.status == "active")
        )
        if existing.first() is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An active war already exists for this alliance",
            )
        war = War(
            alliance_id=alliance_id,
            opponent_name=opponent_name,
            created_by_id=created_by_id,
        )
        session.add(war)
        await session.commit()
        await session.refresh(war)
        return WarResponse.model_validate(await cls._load_war(session, war.id))

    @classmethod
    async def get_wars(
        cls,
        session: SessionDep,
        alliance_id: uuid.UUID,
    ) -> list[WarResponse]:
        stmt = (
            select(War)
            .where(War.alliance_id == alliance_id)
            .options(selectinload(War.created_by))  # type: ignore[arg-type]
            .order_by(War.created_at.desc())  # type: ignore[attr-defined]
        )
        result = await session.exec(stmt)
        wars = result.all()
        return [WarResponse.model_validate(w) for w in wars]

    @classmethod
    async def get_war(
        cls,
        session: SessionDep,
        war_id: uuid.UUID,
        alliance_id: uuid.UUID,
    ) -> War:
        war = await cls._load_war(session, war_id)
        if war is None or war.alliance_id != alliance_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="War not found")
        return war

    @classmethod
    async def _load_war(cls, session: SessionDep, war_id: uuid.UUID) -> Optional[War]:
        stmt = (
            select(War)
            .where(War.id == war_id)
            .options(selectinload(War.created_by))  # type: ignore[arg-type]
        )
        result = await session.exec(stmt)
        return result.first()

    @classmethod
    async def get_war_defense(
        cls,
        session: SessionDep,
        war_id: uuid.UUID,
        battlegroup: int,
    ) -> WarDefenseSummaryResponse:
        placements = await cls._get_placements(session, war_id, battlegroup)
        return WarDefenseSummaryResponse(
            war_id=war_id,
            battlegroup=battlegroup,
            placements=[WarPlacementResponse.model_validate(p) for p in placements],
        )

    @classmethod
    async def _get_placements(
        cls,
        session: SessionDep,
        war_id: uuid.UUID,
        battlegroup: int,
    ) -> list[WarDefensePlacement]:
        stmt = (
            select(WarDefensePlacement)
            .where(
                and_(
                    WarDefensePlacement.war_id == war_id,
                    WarDefensePlacement.battlegroup == battlegroup,
                )
            )
            .options(
                selectinload(WarDefensePlacement.champion),  # type: ignore[arg-type]
                selectinload(WarDefensePlacement.placed_by),  # type: ignore[arg-type]
            )
        )
        result = await session.exec(stmt)
        return result.all()

    @classmethod
    async def _load_placement(
        cls, session: SessionDep, placement_id: uuid.UUID
    ) -> WarDefensePlacement:
        stmt = (
            select(WarDefensePlacement)
            .where(WarDefensePlacement.id == placement_id)
            .options(
                selectinload(WarDefensePlacement.champion),  # type: ignore[arg-type]
                selectinload(WarDefensePlacement.placed_by),  # type: ignore[arg-type]
            )
        )
        result = await session.exec(stmt)
        return result.one()

    @classmethod
    async def place_defender(
        cls,
        session: SessionDep,
        war_id: uuid.UUID,
        battlegroup: int,
        req: WarPlacementCreateRequest,
        placed_by_id: uuid.UUID,
    ) -> WarPlacementResponse:
        # Validate champion exists
        champion = await session.get(Champion, req.champion_id)
        if champion is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Champion not found")

        # Check champion not already placed in this BG (unique per champion_id+war_id+battlegroup)
        existing_champ = await session.exec(
            select(WarDefensePlacement).where(
                and_(
                    WarDefensePlacement.war_id == war_id,
                    WarDefensePlacement.battlegroup == battlegroup,
                    WarDefensePlacement.champion_id == req.champion_id,
                    WarDefensePlacement.node_number != req.node_number,
                )
            )
        )
        if existing_champ.first():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This champion is already placed on another node in this battlegroup",
            )

        # Replace if node already occupied
        existing_node = await session.exec(
            select(WarDefensePlacement).where(
                and_(
                    WarDefensePlacement.war_id == war_id,
                    WarDefensePlacement.battlegroup == battlegroup,
                    WarDefensePlacement.node_number == req.node_number,
                )
            )
        )
        old_placement = existing_node.first()
        if old_placement:
            await session.delete(old_placement)
            await session.flush()

        placement = WarDefensePlacement(
            war_id=war_id,
            battlegroup=battlegroup,
            node_number=req.node_number,
            champion_id=req.champion_id,
            stars=req.stars,
            rank=req.rank,
            ascension=req.ascension,
            placed_by_id=placed_by_id,
        )
        session.add(placement)
        await session.commit()
        await session.refresh(placement)

        return WarPlacementResponse.model_validate(
            await cls._load_placement(session, placement.id)
        )

    @classmethod
    async def remove_defender(
        cls,
        session: SessionDep,
        war_id: uuid.UUID,
        battlegroup: int,
        node_number: int,
    ) -> None:
        result = await session.exec(
            select(WarDefensePlacement).where(
                and_(
                    WarDefensePlacement.war_id == war_id,
                    WarDefensePlacement.battlegroup == battlegroup,
                    WarDefensePlacement.node_number == node_number,
                )
            )
        )
        placement = result.first()
        if placement is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No defender on this node",
            )
        await session.delete(placement)
        await session.commit()

    @classmethod
    async def end_war(
        cls,
        session: SessionDep,
        war_id: uuid.UUID,
        alliance_id: uuid.UUID,
    ) -> WarResponse:
        war = await cls.get_war(session, war_id, alliance_id)
        war.status = "ended"
        session.add(war)
        await session.commit()
        await session.refresh(war)
        return WarResponse.model_validate(await cls._load_war(session, war.id))

    @classmethod
    async def clear_bg(
        cls,
        session: SessionDep,
        war_id: uuid.UUID,
        battlegroup: int,
    ) -> int:
        result = await session.exec(
            select(WarDefensePlacement).where(
                and_(
                    WarDefensePlacement.war_id == war_id,
                    WarDefensePlacement.battlegroup == battlegroup,
                )
            )
        )
        placements = result.all()
        count = len(placements)
        for p in placements:
            await session.delete(p)
        await session.commit()
        return count

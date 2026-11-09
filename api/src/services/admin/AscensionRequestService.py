import uuid

from sqlalchemy import delete, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload
from sqlmodel import col, select

from src.dto.admin.dto_ascension_request import AscensionRequestResponse
from src.Messages.ascension_request_messages import (
    ASCENSION_REQUEST_NOT_FOUND,
    CHAMPION_ALREADY_ASCENDABLE,
)
from src.Messages.champion_messages import CHAMPION_NOT_FOUND
from src.models.champion.AscensionRequest import AscensionRequest
from src.models.champion.Champion import Champion
from src.utils.db import SessionDep


class AscensionRequestService:
    @classmethod
    async def get_requested_champion_ids(cls, session: SessionDep) -> list[uuid.UUID]:
        result = await session.exec(select(AscensionRequest.champion_id))
        return list(result.all())

    @classmethod
    async def create(
        cls, session: SessionDep, champion_id: uuid.UUID, requester_user_id: uuid.UUID
    ) -> None:
        champion = await session.get(Champion, champion_id)
        if champion is None:
            raise CHAMPION_NOT_FOUND
        if champion.is_ascendable:
            raise CHAMPION_ALREADY_ASCENDABLE

        # ponytail: no mute check yet, ModerationService.is_user_muted to add, as notes do.
        # ponytail: Admins only have the tab counter, a Discord webhook when they must be pinged.
        session.add(AscensionRequest(champion_id=champion_id, requester_user_id=requester_user_id))
        try:
            await session.commit()
        except IntegrityError:
            # Already requested, concurrently or not: the first requester stays.
            await session.rollback()

    @classmethod
    async def get_pending(cls, session: SessionDep) -> list[AscensionRequestResponse]:
        result = await session.exec(
            select(AscensionRequest)
            .options(
                selectinload(AscensionRequest.champion),  # type: ignore[arg-type]
                selectinload(AscensionRequest.requester),  # type: ignore[arg-type]
            )
            .order_by(col(AscensionRequest.created_at), col(AscensionRequest.id))
        )
        return [
            AscensionRequestResponse(
                id=request.id,
                champion_id=request.champion_id,
                champion_name=request.champion.name,
                image_url=request.champion.image_url,
                requester_login=request.requester.login,
                created_at=request.created_at,
            )
            for request in result.all()
        ]

    @classmethod
    async def _get_or_404(cls, session: SessionDep, request_id: uuid.UUID) -> AscensionRequest:
        request = await session.get(AscensionRequest, request_id)
        if request is None:
            raise ASCENSION_REQUEST_NOT_FOUND
        return request

    @classmethod
    async def accept(cls, session: SessionDep, request_id: uuid.UUID) -> None:
        request = await cls._get_or_404(session, request_id)
        await session.exec(
            update(Champion)
            .where(col(Champion.id) == request.champion_id)
            .values(is_ascendable=True)
        )
        await cls.remove_resolved(session)
        await session.commit()

    @classmethod
    async def refuse(cls, session: SessionDep, request_id: uuid.UUID) -> None:
        await session.delete(await cls._get_or_404(session, request_id))
        await session.commit()

    @classmethod
    async def remove_resolved(cls, session: SessionDep) -> None:
        """Remove every request whose Champion is now ascendable. The caller commits."""
        await session.exec(
            delete(AscensionRequest).where(
                col(AscensionRequest.champion_id).in_(
                    select(Champion.id).where(col(Champion.is_ascendable))
                )
            )
        )

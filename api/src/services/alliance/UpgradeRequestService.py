import uuid
from datetime import datetime

from fastapi import HTTPException
from sqlmodel import select, and_
from sqlalchemy.orm import selectinload
from starlette import status

from src.models.RequestedUpgrade import RequestedUpgrade
from src.models.ChampionUser import ChampionUser
from src.enums.ChampionRarity import ChampionRarity
from src.Messages.upgrade_request_messages import (
    CHAMPION_USER_ENTRY_NOT_FOUND,
    UPGRADE_REQUEST_ALREADY_EXISTS,
    UPGRADE_REQUEST_NOT_FOUND,
    invalid_requested_rarity,
    requested_rarity_must_be_higher,
)
from src.utils.db import SessionDep

VALID_RARITIES = {r.value for r in ChampionRarity}


class UpgradeRequestService:
    @classmethod
    async def create_upgrade_request(
        cls,
        session: SessionDep,
        champion_user_id: uuid.UUID,
        requester_game_account_id: uuid.UUID,
        requested_rarity: str,
    ) -> RequestedUpgrade:
        """Create a new upgrade request for a champion user entry."""
        if requested_rarity not in VALID_RARITIES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=invalid_requested_rarity(
                    requested_rarity,
                    ", ".join(sorted(VALID_RARITIES)),
                ),
            )

        # Load champion_user with champion relationship
        stmt = (
            select(ChampionUser)
            .where(ChampionUser.id == champion_user_id)
            .options(selectinload(ChampionUser.champion))  # type: ignore[arg-type]
        )
        result = await session.exec(stmt)
        champion_user = result.first()
        if champion_user is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=CHAMPION_USER_ENTRY_NOT_FOUND,
            )

        # requested_rarity must be higher than current
        current = champion_user.rarity
        if requested_rarity <= current:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=requested_rarity_must_be_higher(requested_rarity, current),
            )

        # A champion should carry at most one pending upgrade request: the target
        # rarity, not one row per rarity ever aimed at. If a pending request already
        # exists, retarget it (latest request wins) instead of creating a new one.
        existing_pending = (
            await session.exec(
                select(RequestedUpgrade).where(
                    and_(
                        RequestedUpgrade.champion_user_id == champion_user_id,
                        RequestedUpgrade.done_at.is_(None),  # type: ignore[union-attr]
                    )
                )
            )
        ).all()

        if existing_pending:
            # Re-requesting the rarity that is already pending is a conflict.
            if any(req.requested_rarity == requested_rarity for req in existing_pending):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=UPGRADE_REQUEST_ALREADY_EXISTS,
                )
            # Retarget the first pending request and drop any stale duplicates so the
            # invariant "one pending request per champion" holds even for legacy rows.
            primary, *duplicates = existing_pending
            primary.requested_rarity = requested_rarity
            primary.requester_game_account_id = requester_game_account_id
            session.add(primary)
            for stale in duplicates:
                await session.delete(stale)
            await session.commit()
            await session.refresh(primary)
            return primary

        upgrade_request = RequestedUpgrade(
            champion_user_id=champion_user_id,
            requester_game_account_id=requester_game_account_id,
            requested_rarity=requested_rarity,
        )
        session.add(upgrade_request)
        await session.commit()
        await session.refresh(upgrade_request)
        return upgrade_request

    @classmethod
    async def get_pending_by_game_account(
        cls, session: SessionDep, game_account_id: uuid.UUID
    ) -> list[RequestedUpgrade]:
        """Get all pending (not done) upgrade requests for a game account's roster."""
        stmt = (
            select(RequestedUpgrade)
            .join(ChampionUser, RequestedUpgrade.champion_user_id == ChampionUser.id)
            .where(
                and_(
                    ChampionUser.game_account_id == game_account_id,
                    RequestedUpgrade.done_at.is_(None),  # type: ignore[union-attr]
                )
            )
            .options(
                selectinload(RequestedUpgrade.champion_user).selectinload(ChampionUser.champion),  # type: ignore[arg-type]
                selectinload(RequestedUpgrade.requester),  # type: ignore[arg-type]
            )
        )
        result = await session.exec(stmt)
        return list(result.all())

    @classmethod
    async def cancel_upgrade_request(cls, session: SessionDep, request_id: uuid.UUID) -> None:
        """Delete an upgrade request."""
        upgrade_request = await session.get(RequestedUpgrade, request_id)
        if upgrade_request is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=UPGRADE_REQUEST_NOT_FOUND,
            )
        await session.delete(upgrade_request)
        await session.commit()

    @classmethod
    async def auto_complete_for_champion_user(
        cls, session: SessionDep, champion_user: ChampionUser
    ) -> None:
        """Mark pending upgrade requests as done if the champion has reached the requested rarity."""
        current_rarity = champion_user.rarity
        stmt = select(RequestedUpgrade).where(
            and_(
                RequestedUpgrade.champion_user_id == champion_user.id,
                RequestedUpgrade.done_at.is_(None),  # type: ignore[union-attr]
                RequestedUpgrade.requested_rarity <= current_rarity,
            )
        )
        result = await session.exec(stmt)
        requests = result.all()
        for req in requests:
            req.done_at = datetime.now()
            session.add(req)
        if requests:
            await session.commit()

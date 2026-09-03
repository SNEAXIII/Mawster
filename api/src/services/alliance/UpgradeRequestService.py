import uuid

from fastapi import HTTPException
from sqlalchemy.orm import selectinload
from sqlmodel import and_, or_, select
from starlette import status

from src.enums.ChampionRarity import ChampionRarity
from src.Messages.upgrade_request_messages import (
    CHAMPION_USER_ENTRY_NOT_FOUND,
    UPGRADE_REQUEST_ALREADY_EXISTS,
    UPGRADE_REQUEST_NOT_FOUND,
    invalid_requested_rarity,
    requested_rarity_must_be_higher,
)
from src.models.Base import utcnow
from src.models.champion.ChampionUser import ChampionUser
from src.models.champion.RequestedUpgrade import RequestedUpgrade
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
        rarity = ChampionRarity.from_code(requested_rarity)
        if rarity is None:
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

        # The target must be higher than what the player already has, compared on the
        # (stars, rank) pair rather than on the code — ordering never depends on how a
        # rarity happens to be spelled.
        if rarity.order <= (champion_user.stars, champion_user.rank):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=requested_rarity_must_be_higher(rarity.value, champion_user.rarity),
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
            if any(req.requested_rarity == rarity.value for req in existing_pending):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=UPGRADE_REQUEST_ALREADY_EXISTS,
                )
            # Retarget the first pending request and drop any stale duplicates so the
            # invariant "one pending request per champion" holds even for legacy rows.
            primary, *duplicates = existing_pending
            primary.requested_stars = rarity.stars
            primary.requested_rank = rarity.rank
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
            requested_stars=rarity.stars,
            requested_rank=rarity.rank,
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
    async def cancel_pending_for_member(
        cls, session: SessionDep, game_account_id: uuid.UUID
    ) -> int:
        """Drop every pending upgrade request aimed at a member's roster.

        Called when a member leaves or is kicked: the request was the alliance
        asking for a rank-up, and once the roster is gone nobody can act on it
        — nor even cancel it, since cancelling requires an officer of the
        alliance the champion owner belongs to.
        Requests already marked done are history and are kept.
        Flushes but does not commit — the caller owns the transaction.
        Returns the number of requests deleted."""
        stmt = (
            select(RequestedUpgrade)
            .join(ChampionUser, RequestedUpgrade.champion_user_id == ChampionUser.id)
            .where(
                and_(
                    ChampionUser.game_account_id == game_account_id,
                    RequestedUpgrade.done_at.is_(None),  # type: ignore[union-attr]
                )
            )
        )
        result = await session.exec(stmt)
        requests = result.all()
        for req in requests:
            await session.delete(req)
        await session.flush()
        return len(requests)

    @classmethod
    async def auto_complete_for_champion_user(
        cls, session: SessionDep, champion_user: ChampionUser
    ) -> None:
        """Mark pending upgrade requests as done if the champion has reached the requested rarity."""
        stmt = select(RequestedUpgrade).where(
            and_(
                RequestedUpgrade.champion_user_id == champion_user.id,
                RequestedUpgrade.done_at.is_(None),  # type: ignore[union-attr]
                # Reached: fewer stars than the champion now has, or the same stars
                # and a rank the champion has caught up with.
                or_(
                    RequestedUpgrade.requested_stars < champion_user.stars,
                    and_(
                        RequestedUpgrade.requested_stars == champion_user.stars,
                        RequestedUpgrade.requested_rank <= champion_user.rank,
                    ),
                ),
            )
        )
        result = await session.exec(stmt)
        requests = result.all()
        for req in requests:
            req.done_at = utcnow()
            session.add(req)
        if requests:
            await session.commit()

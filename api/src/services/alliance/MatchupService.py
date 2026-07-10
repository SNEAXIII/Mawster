import uuid
from typing import Optional

from sqlalchemy.orm import selectinload
from sqlmodel import select

from fastapi import HTTPException, status

from src.dto.alliance.dto_matchup import MatchupUpsertRequest
from src.Messages.matchup_messages import MATCHUP_NOT_FOUND
from src.models.MatchupRating import MatchupRating
from src.models.MatchupSynergy import MatchupSynergy
from src.models.Base import utcnow
from src.services.alliance.matchup_scoring import build_target_key
from src.utils.db import SessionDep


class MatchupService:
    """Persistence and evaluation of an alliance's matchup ratings."""

    _RATING_RELATIONS = (
        selectinload(MatchupRating.champion),
        selectinload(MatchupRating.defender_champion),
        selectinload(MatchupRating.prefight_champion),
        selectinload(MatchupRating.synergies).selectinload(MatchupSynergy.champion),
    )

    @classmethod
    async def upsert(
        cls,
        session: SessionDep,
        alliance_id: uuid.UUID,
        author_game_account_id: uuid.UUID,
        request: MatchupUpsertRequest,
    ) -> list[MatchupRating]:
        """Write one rating per target, overwriting any rating on the same target.

        The whole request lands in a single transaction: the unified form rates a champion
        against a defender and a node together, and a half-written pair would be worse than
        no rating at all.
        """
        ratings: list[MatchupRating] = []
        for target in request.targets:
            target_key = build_target_key(
                target.target_type, target.defender_champion_id, target.node_number
            )
            existing = (
                await session.exec(
                    select(MatchupRating).where(
                        MatchupRating.alliance_id == alliance_id,
                        MatchupRating.champion_id == request.champion_id,
                        MatchupRating.target_key == target_key,
                    )
                )
            ).first()

            if existing is None:
                existing = MatchupRating(
                    alliance_id=alliance_id,
                    champion_id=request.champion_id,
                    target_type=target.target_type,
                    defender_champion_id=target.defender_champion_id,
                    node_number=target.node_number,
                    target_key=target_key,
                    verdict=target.verdict,
                    prefight_champion_id=target.prefight_champion_id,
                    created_by_game_account_id=author_game_account_id,
                    updated_by_game_account_id=author_game_account_id,
                )
                session.add(existing)
                await session.flush()
            else:
                existing.verdict = target.verdict
                existing.prefight_champion_id = target.prefight_champion_id
                existing.updated_by_game_account_id = author_game_account_id
                existing.updated_at = utcnow()
                # Replace the synergies wholesale: an edit describes the fight as it is now,
                # not a delta. The repo deletes row by row (see DefensePlacementService).
                stale = (
                    await session.exec(
                        select(MatchupSynergy).where(
                            MatchupSynergy.matchup_rating_id == existing.id
                        )
                    )
                ).all()
                for synergy in stale:
                    await session.delete(synergy)
                await session.flush()

            for synergy in target.synergies:
                session.add(
                    MatchupSynergy(
                        matchup_rating_id=existing.id,
                        champion_id=synergy.champion_id,
                        is_required=synergy.is_required,
                    )
                )
            ratings.append(existing)

        await session.commit()
        return await cls._reload(session, [rating.id for rating in ratings])

    @classmethod
    async def list_ratings(
        cls,
        session: SessionDep,
        alliance_id: uuid.UUID,
        champion_id: Optional[uuid.UUID] = None,
        defender_champion_id: Optional[uuid.UUID] = None,
        node_number: Optional[int] = None,
    ) -> list[MatchupRating]:
        """List an alliance's ratings, optionally narrowed to one attacker or one target."""
        sql = select(MatchupRating).where(MatchupRating.alliance_id == alliance_id)
        if champion_id is not None:
            sql = sql.where(MatchupRating.champion_id == champion_id)
        if defender_champion_id is not None:
            sql = sql.where(MatchupRating.defender_champion_id == defender_champion_id)
        if node_number is not None:
            sql = sql.where(MatchupRating.node_number == node_number)
        result = await session.exec(sql.options(*cls._RATING_RELATIONS))
        return list(result.all())

    @classmethod
    async def delete(
        cls, session: SessionDep, alliance_id: uuid.UUID, rating_id: uuid.UUID
    ) -> None:
        """Delete one rating. Its synergies cascade."""
        rating = (
            await session.exec(
                select(MatchupRating).where(
                    MatchupRating.id == rating_id,
                    MatchupRating.alliance_id == alliance_id,
                )
            )
        ).first()
        if rating is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=MATCHUP_NOT_FOUND)
        await session.delete(rating)
        await session.commit()

    @classmethod
    async def _reload(cls, session: SessionDep, rating_ids: list[uuid.UUID]) -> list[MatchupRating]:
        result = await session.exec(
            select(MatchupRating)
            .where(MatchupRating.id.in_(rating_ids))
            .options(*cls._RATING_RELATIONS)
        )
        return list(result.all())

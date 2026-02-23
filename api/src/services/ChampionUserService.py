import re
import uuid
from typing import Optional

from fastapi import HTTPException
from sqlmodel import select, and_
from sqlalchemy.orm import selectinload
from starlette import status

from src.enums.ChampionRarity import ChampionRarity
from src.models.GameAccount import GameAccount
from src.models.Champion import Champion
from src.models.ChampionUser import ChampionUser
from src.utils.db import SessionDep

VALID_RARITIES = {r.value for r in ChampionRarity}

_RARITY_RE = re.compile(r"^(\d+)r(\d+)$")


class ChampionUserService:

    @classmethod
    def _validate_rarity(cls, rarity: str) -> None:
        """Validate that the rarity value is one of the allowed values."""
        if rarity not in VALID_RARITIES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid rarity '{rarity}'. Must be one of: {', '.join(sorted(VALID_RARITIES))}",
            )

    @classmethod
    def _parse_rarity(cls, rarity: str) -> tuple[int, int]:
        """Parse a rarity code like '7r5' into (stars=7, rank=5).

        Also validates that the code is allowed.
        """
        cls._validate_rarity(rarity)
        m = _RARITY_RE.match(rarity)
        # regex always matches for valid rarities, but guard anyway
        if m is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid rarity format '{rarity}'",
            )
        return int(m.group(1)), int(m.group(2))

    @classmethod
    async def create_champion_user(
        cls,
        session: SessionDep,
        game_account_id: uuid.UUID,
        champion_id: uuid.UUID,
        rarity: str,
        signature: int = 0,
    ) -> ChampionUser:
        stars, rank = cls._parse_rarity(rarity)

        # Verify the game account exists
        game_account = await session.get(GameAccount, game_account_id)
        if game_account is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Game account not found",
            )

        # Verify the champion exists
        champion = await session.get(Champion, champion_id)
        if champion is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Champion not found",
            )

        # Check if same champion + stars + rank already exists → update signature
        existing = await session.exec(
            select(ChampionUser).where(
                and_(
                    ChampionUser.game_account_id == game_account_id,
                    ChampionUser.champion_id == champion_id,
                    ChampionUser.stars == stars,
                    ChampionUser.rank == rank,
                )
            )
        )
        existing_entry = existing.first()
        if existing_entry is not None:
            existing_entry.signature = signature
            session.add(existing_entry)
            await session.commit()
            await session.refresh(existing_entry)
            return existing_entry

        champion_user = ChampionUser(
            game_account_id=game_account_id,
            champion_id=champion_id,
            stars=stars,
            rank=rank,
            signature=signature,
        )
        session.add(champion_user)
        await session.commit()
        await session.refresh(champion_user)
        return champion_user

    @classmethod
    async def bulk_add_champions(
        cls,
        session: SessionDep,
        game_account_id: uuid.UUID,
        champions: list[dict],
    ) -> list[ChampionUser]:
        """Add multiple champions to a roster with dedup logic.

        - If a champion+rarity appears multiple times in the request, only the first occurrence is used.
        - If a champion+rarity already exists in DB, update the signature.
        """
        # Verify the game account exists
        game_account = await session.get(GameAccount, game_account_id)
        if game_account is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Game account not found",
            )

        results = []
        seen = set()  # (champion_id, stars, rank) tuples already processed

        for entry in champions:
            champion_id = entry["champion_id"]
            rarity = entry["rarity"]
            signature = entry.get("signature", 0)

            stars, rank = cls._parse_rarity(rarity)

            # Dedup within same request: skip duplicates
            key = (str(champion_id), stars, rank)
            if key in seen:
                continue
            seen.add(key)

            # Verify champion exists
            champion = await session.get(Champion, champion_id)
            if champion is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Champion {champion_id} not found",
                )

            # Check if exists in DB
            existing = await session.exec(
                select(ChampionUser).where(
                    and_(
                        ChampionUser.game_account_id == game_account_id,
                        ChampionUser.champion_id == champion_id,
                        ChampionUser.stars == stars,
                        ChampionUser.rank == rank,
                    )
                )
            )
            existing_entry = existing.first()

            if existing_entry is not None:
                existing_entry.signature = signature
                session.add(existing_entry)
                results.append(existing_entry)
            else:
                champion_user = ChampionUser(
                    game_account_id=game_account_id,
                    champion_id=champion_id,
                    stars=stars,
                    rank=rank,
                    signature=signature,
                )
                session.add(champion_user)
                results.append(champion_user)

        await session.commit()
        for r in results:
            await session.refresh(r)
        return results

    @classmethod
    async def get_roster_by_game_account(
        cls, session: SessionDep, game_account_id: uuid.UUID
    ) -> list[ChampionUser]:
        sql = (
            select(ChampionUser)
            .where(ChampionUser.game_account_id == game_account_id)
            .options(selectinload(ChampionUser.champion))  # type: ignore[arg-type]
        )
        result = await session.exec(sql)
        return result.all()

    @classmethod
    async def get_champion_user(
        cls, session: SessionDep, champion_user_id: uuid.UUID
    ) -> Optional[ChampionUser]:
        return await session.get(ChampionUser, champion_user_id)

    @classmethod
    async def update_champion_user(
        cls,
        session: SessionDep,
        champion_user: ChampionUser,
        rarity: str,
        signature: int = 0,
    ) -> ChampionUser:
        stars, rank = cls._parse_rarity(rarity)
        champion_user.stars = stars
        champion_user.rank = rank
        champion_user.signature = signature
        session.add(champion_user)
        await session.commit()
        await session.refresh(champion_user)
        return champion_user

    @classmethod
    async def delete_champion_user(
        cls, session: SessionDep, champion_user: ChampionUser
    ) -> None:
        await session.delete(champion_user)
        await session.commit()

    @classmethod
    async def delete_roster(
        cls, session: SessionDep, game_account_id: uuid.UUID
    ) -> int:
        """Delete all roster entries for a game account. Returns count deleted."""
        sql = select(ChampionUser).where(
            ChampionUser.game_account_id == game_account_id
        )
        result = await session.exec(sql)
        entries = result.all()
        count = len(entries)
        for entry in entries:
            await session.delete(entry)
        await session.commit()
        return count

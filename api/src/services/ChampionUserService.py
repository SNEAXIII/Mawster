import re
import uuid
from typing import Optional

from fastapi import HTTPException
from sqlmodel import select, and_
from sqlalchemy.orm import selectinload
from starlette import status

from src.services.ChampionService import ChampionService
from src.services.UpgradeRequestService import UpgradeRequestService
from src.enums.ChampionRarity import ChampionRarity
from src.Messages.champion_user_messages import (
    CHAMPION_CANNOT_BE_ASCENDED,
    CHAMPION_NOT_FOUND,
    GAME_ACCOUNT_NOT_FOUND,
    champion_already_max_ascension,
    champion_already_max_rank,
    champion_name_not_found,
    invalid_ascension_level,
    invalid_rarity,
    invalid_rarity_format,
)
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
                detail=invalid_rarity(rarity, ", ".join(sorted(VALID_RARITIES))),
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
                detail=invalid_rarity_format(rarity),
            )
        return int(m.group(1)), int(m.group(2))

    @classmethod
    def _validate_ascension(cls, ascension: int, champion: Champion) -> int:
        """Validate and potentially coerce ascension level.

        - If the champion is not ascendable, force ascension to 0.
        - If ascension is not in {0, 1, 2}, raise 400.
        """
        if ascension not in (0, 1, 2):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=invalid_ascension_level(ascension),
            )
        if not champion.is_ascendable:
            return 0
        return ascension

    @classmethod
    async def create_champion_user(
        cls,
        session: SessionDep,
        game_account_id: uuid.UUID,
        champion_id: uuid.UUID,
        rarity: str,
        signature: int = 0,
        is_preferred_attacker: bool = False,
        ascension: int = 0,
    ) -> ChampionUser:
        stars, rank = cls._parse_rarity(rarity)

        # Verify the game account exists
        game_account = await session.get(GameAccount, game_account_id)
        if game_account is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=GAME_ACCOUNT_NOT_FOUND,
            )

        # Verify the champion exists
        champion = await session.get(Champion, champion_id)
        if champion is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=CHAMPION_NOT_FOUND,
            )

        # Validate ascension
        ascension = cls._validate_ascension(ascension, champion)

        # Check if same champion + stars already exists → update rank & signature
        existing = await session.exec(
            select(ChampionUser).where(
                and_(
                    ChampionUser.game_account_id == game_account_id,
                    ChampionUser.champion_id == champion_id,
                    ChampionUser.stars == stars,
                )
            )
        )
        existing_entry = existing.first()
        if existing_entry is not None:
            existing_entry.rank = rank
            existing_entry.signature = signature
            existing_entry.is_preferred_attacker = is_preferred_attacker
            existing_entry.ascension = ascension
            session.add(existing_entry)
            await session.commit()
            await session.refresh(existing_entry)
            await UpgradeRequestService.auto_complete_for_champion_user(session, existing_entry)
            return existing_entry

        champion_user = ChampionUser(
            game_account_id=game_account_id,
            champion_id=champion_id,
            stars=stars,
            rank=rank,
            signature=signature,
            is_preferred_attacker=is_preferred_attacker,
            ascension=ascension,
        )
        session.add(champion_user)
        await session.commit()
        await session.refresh(champion_user)
        await UpgradeRequestService.auto_complete_for_champion_user(session, champion_user)
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
                detail=GAME_ACCOUNT_NOT_FOUND,
            )

        results = []
        seen = set()  # (champion_name_lower, stars) tuples already processed

        for entry in champions:
            champion_name = entry["champion_name"]
            rarity = entry["rarity"]
            signature = entry.get("signature", 0)

            stars, rank = cls._parse_rarity(rarity)

            # Dedup within same request: skip duplicates (unique per champion+stars)
            key = (champion_name.lower(), stars)
            if key in seen:
                continue
            seen.add(key)

            # Resolve champion by name
            champion = await ChampionService.get_champion_by_name(session, champion_name)
            if champion is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=champion_name_not_found(champion_name),
                )

            is_preferred_attacker = entry.get("is_preferred_attacker", False)
            ascension = cls._validate_ascension(entry.get("ascension", 0), champion)

            # Check if exists in DB (unique per champion+stars)
            existing = await session.exec(
                select(ChampionUser).where(
                    and_(
                        ChampionUser.game_account_id == game_account_id,
                        ChampionUser.champion_id == champion.id,
                        ChampionUser.stars == stars,
                    )
                )
            )
            existing_entry = existing.first()

            if existing_entry is not None:
                existing_entry.rank = rank
                existing_entry.signature = signature
                existing_entry.is_preferred_attacker = is_preferred_attacker
                existing_entry.ascension = ascension
                session.add(existing_entry)
                results.append(existing_entry)
            else:
                champion_user = ChampionUser(
                    game_account_id=game_account_id,
                    champion_id=champion.id,
                    stars=stars,
                    rank=rank,
                    signature=signature,
                    is_preferred_attacker=is_preferred_attacker,
                    ascension=ascension,
                )
                session.add(champion_user)
                results.append(champion_user)

        await session.commit()
        for r in results:
            await session.refresh(r)

        # Auto-complete upgrade requests
        for r in results:
            await UpgradeRequestService.auto_complete_for_champion_user(session, r)

        # Eagerly load champion relationship for detail responses
        refreshed = []
        for r in results:
            stmt = (
                select(ChampionUser)
                .where(ChampionUser.id == r.id)
                .options(selectinload(ChampionUser.champion))  # type: ignore[arg-type]
            )
            res = await session.exec(stmt)
            refreshed.append(res.one())
        return refreshed

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
        await UpgradeRequestService.auto_complete_for_champion_user(session, champion_user)
        return champion_user

    @classmethod
    async def delete_champion_user(cls, session: SessionDep, champion_user: ChampionUser) -> None:
        await session.delete(champion_user)
        await session.commit()

    @classmethod
    async def upgrade_champion_rank(
        cls, session: SessionDep, champion_user: ChampionUser
    ) -> ChampionUser:
        """Promote a champion to the next rank (e.g. 7r2 → 7r3).

        Raises 400 if the champion is already at the maximum rank for its star level.
        """
        current_rarity = champion_user.rarity  # e.g. "7r2"
        stars, rank = cls._parse_rarity(current_rarity)

        # Build the next rarity string
        next_rank = rank + 1
        next_rarity = f"{stars}r{next_rank}"

        if next_rarity not in VALID_RARITIES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=champion_already_max_rank(current_rarity),
            )

        champion_user.rank = next_rank
        session.add(champion_user)
        await session.commit()
        await session.refresh(champion_user)
        await UpgradeRequestService.auto_complete_for_champion_user(session, champion_user)
        return champion_user

    @classmethod
    async def ascend_champion(
        cls, session: SessionDep, champion_user: ChampionUser
    ) -> ChampionUser:
        """Ascend a champion to the next ascension level (0 → 1 → 2).

        Raises 400 if the champion is not ascendable or already at max ascension.
        """
        # Eagerly load champion if not already loaded
        champion = await session.get(Champion, champion_user.champion_id)
        if champion is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=CHAMPION_NOT_FOUND,
            )

        if not champion.is_ascendable:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=CHAMPION_CANNOT_BE_ASCENDED,
            )

        if champion_user.ascension >= 2:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=champion_already_max_ascension(champion_user.ascension),
            )

        champion_user.ascension += 1
        session.add(champion_user)
        await session.commit()
        await session.refresh(champion_user)
        return champion_user

    @classmethod
    async def delete_roster(cls, session: SessionDep, game_account_id: uuid.UUID) -> int:
        """Delete all roster entries for a game account. Returns count deleted."""
        sql = select(ChampionUser).where(ChampionUser.game_account_id == game_account_id)
        result = await session.exec(sql)
        entries = result.all()
        count = len(entries)
        for entry in entries:
            await session.delete(entry)
        await session.commit()
        return count

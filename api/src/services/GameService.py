import uuid
from typing import Optional

from fastapi import HTTPException
from sqlmodel import select
from sqlalchemy.orm import selectinload
from starlette import status

from src.models.GameAccount import GameAccount
from src.models.Alliance import Alliance
from src.models.AllianceAdjoint import AllianceAdjoint
from src.models.Champion import Champion
from src.models.ChampionUser import ChampionUser
from src.utils.db import SessionDep


class GameAccountService:
    @classmethod
    async def create_game_account(
        cls,
        session: SessionDep,
        user_id: uuid.UUID,
        game_pseudo: str,
        is_primary: bool = False,
    ) -> GameAccount:
        game_account = GameAccount(
            user_id=user_id,
            game_pseudo=game_pseudo,
            is_primary=is_primary,
        )
        session.add(game_account)
        await session.commit()
        await session.refresh(game_account)
        return game_account

    @classmethod
    async def get_game_accounts_by_user(
        cls, session: SessionDep, user_id: uuid.UUID
    ) -> list[GameAccount]:
        sql = select(GameAccount).where(GameAccount.user_id == user_id)
        result = await session.exec(sql)
        return result.all()

    @classmethod
    async def get_game_account(
        cls, session: SessionDep, game_account_id: uuid.UUID
    ) -> Optional[GameAccount]:
        return await session.get(GameAccount, game_account_id)

    @classmethod
    async def update_game_account(
        cls,
        session: SessionDep,
        game_account: GameAccount,
        game_pseudo: str,
        is_primary: bool,
    ) -> GameAccount:
        game_account.game_pseudo = game_pseudo
        game_account.is_primary = is_primary
        session.add(game_account)
        await session.commit()
        await session.refresh(game_account)
        return game_account

    @classmethod
    async def delete_game_account(
        cls, session: SessionDep, game_account: GameAccount
    ) -> None:
        await session.delete(game_account)
        await session.commit()


class AllianceService:
    @classmethod
    async def _load_alliance_with_relations(
        cls, session: SessionDep, alliance_id: uuid.UUID
    ) -> Optional[Alliance]:
        """Load an alliance with owner and adjoints eagerly loaded."""
        sql = (
            select(Alliance)
            .where(Alliance.id == alliance_id)
            .options(
                selectinload(Alliance.owner),  # type: ignore[arg-type]
                selectinload(Alliance.adjoints).selectinload(AllianceAdjoint.game_account),  # type: ignore[arg-type]
            )
        )
        result = await session.exec(sql)
        return result.first()

    @classmethod
    async def create_alliance(
        cls,
        session: SessionDep,
        name: str,
        tag: str,
        owner_id: uuid.UUID,
    ) -> Alliance:
        # Verify owner game account exists
        owner = await session.get(GameAccount, owner_id)
        if owner is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Owner game account not found",
            )
        alliance = Alliance(
            name=name,
            tag=tag,
            owner_id=owner_id,
        )
        session.add(alliance)
        await session.commit()
        return await cls._load_alliance_with_relations(session, alliance.id)

    @classmethod
    async def get_alliance(
        cls, session: SessionDep, alliance_id: uuid.UUID
    ) -> Optional[Alliance]:
        return await cls._load_alliance_with_relations(session, alliance_id)

    @classmethod
    async def get_all_alliances(
        cls, session: SessionDep
    ) -> list[Alliance]:
        sql = (
            select(Alliance)
            .options(
                selectinload(Alliance.owner),  # type: ignore[arg-type]
                selectinload(Alliance.adjoints).selectinload(AllianceAdjoint.game_account),  # type: ignore[arg-type]
            )
        )
        result = await session.exec(sql)
        return result.all()

    @classmethod
    async def update_alliance(
        cls,
        session: SessionDep,
        alliance: Alliance,
        name: str,
        tag: str,
    ) -> Alliance:
        alliance.name = name
        alliance.tag = tag
        session.add(alliance)
        await session.commit()
        return await cls._load_alliance_with_relations(session, alliance.id)

    @classmethod
    async def delete_alliance(
        cls, session: SessionDep, alliance: Alliance
    ) -> None:
        await session.delete(alliance)
        await session.commit()

    @classmethod
    async def add_adjoint(
        cls,
        session: SessionDep,
        alliance_id: uuid.UUID,
        game_account_id: uuid.UUID,
    ) -> Alliance:
        """Add a game account as adjoint of the alliance."""
        # Verify game account exists
        game_account = await session.get(GameAccount, game_account_id)
        if game_account is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Game account not found",
            )
        # Check not already adjoint
        existing = await session.exec(
            select(AllianceAdjoint).where(
                AllianceAdjoint.alliance_id == alliance_id,
                AllianceAdjoint.game_account_id == game_account_id,
            )
        )
        if existing.first() is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Game account is already an adjoint of this alliance",
            )
        adjoint = AllianceAdjoint(
            alliance_id=alliance_id,
            game_account_id=game_account_id,
        )
        session.add(adjoint)
        await session.commit()
        return await cls._load_alliance_with_relations(session, alliance_id)

    @classmethod
    async def remove_adjoint(
        cls,
        session: SessionDep,
        alliance_id: uuid.UUID,
        game_account_id: uuid.UUID,
    ) -> Alliance:
        """Remove a game account from the alliance's adjoints."""
        result = await session.exec(
            select(AllianceAdjoint).where(
                AllianceAdjoint.alliance_id == alliance_id,
                AllianceAdjoint.game_account_id == game_account_id,
            )
        )
        adjoint = result.first()
        if adjoint is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="This game account is not an adjoint of this alliance",
            )
        await session.delete(adjoint)
        await session.commit()
        return await cls._load_alliance_with_relations(session, alliance_id)


class ChampionUserService:
    @classmethod
    async def create_champion_user(
        cls,
        session: SessionDep,
        game_account_id: uuid.UUID,
        champion_id: uuid.UUID,
        stars: int = 0,
        rank: int = 1,
        level: int = 1,
        signature: int = 0,
    ) -> ChampionUser:
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

        champion_user = ChampionUser(
            game_account_id=game_account_id,
            champion_id=champion_id,
            stars=stars,
            rank=rank,
            level=level,
            signature=signature,
        )
        session.add(champion_user)
        await session.commit()
        await session.refresh(champion_user)
        return champion_user

    @classmethod
    async def get_roster_by_game_account(
        cls, session: SessionDep, game_account_id: uuid.UUID
    ) -> list[ChampionUser]:
        sql = select(ChampionUser).where(
            ChampionUser.game_account_id == game_account_id
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
        stars: int,
        rank: int,
        level: int,
        signature: int,
    ) -> ChampionUser:
        champion_user.stars = stars
        champion_user.rank = rank
        champion_user.level = level
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

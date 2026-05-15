import uuid
from typing import Optional

from fastapi import HTTPException
from sqlmodel import select, and_
from sqlalchemy.orm import selectinload
from starlette import status

from src.models.Alliance import Alliance
from src.models.AllianceOfficer import AllianceOfficer
from src.models.ChampionUser import ChampionUser
from src.models.DefensePlacement import DefensePlacement
from src.models.GameAccount import GameAccount
from src.Messages.defense_messages import (
    CHAMPION_ALREADY_PLACED_OTHER_NODE,
    CHAMPION_NOT_BELONG_TO_PLAYER,
    CHAMPION_NOT_FOUND_IN_ROSTER,
    GAME_ACCOUNT_NOT_FOUND,
    NO_DEFENDER_ON_NODE,
    PLAYER_NOT_IN_ALLIANCE,
    PLAYER_NOT_IN_BATTLEGROUP,
    player_max_defenders_reached,
)
from src.utils.db import SessionDep

MAX_DEFENDERS_PER_PLAYER = 5


class DefensePlacementService:
    @classmethod
    async def get_defense(
        cls,
        session: SessionDep,
        alliance_id: uuid.UUID,
        battlegroup: int,
    ) -> list[DefensePlacement]:
        """Get all defense placements for a battlegroup."""
        stmt = (
            select(DefensePlacement)
            .where(
                and_(
                    DefensePlacement.alliance_id == alliance_id,
                    DefensePlacement.battlegroup == battlegroup,
                )
            )
            .options(
                selectinload(DefensePlacement.champion_user).selectinload(ChampionUser.champion),  # type: ignore[arg-type]
                selectinload(DefensePlacement.game_account),  # type: ignore[arg-type]
                selectinload(DefensePlacement.placed_by),  # type: ignore[arg-type]
            )
        )
        result = await session.exec(stmt)
        return result.all()

    @classmethod
    async def place_defender(
        cls,
        session: SessionDep,
        alliance_id: uuid.UUID,
        battlegroup: int,
        node_number: int,
        champion_user_id: uuid.UUID,
        game_account_id: uuid.UUID,
        placed_by_id: Optional[uuid.UUID] = None,
    ) -> DefensePlacement:
        """Place a defender on a node. Validates all business rules."""
        # 1. Verify the champion_user exists and belongs to game_account
        champion_user = await session.get(ChampionUser, champion_user_id)
        if champion_user is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=CHAMPION_NOT_FOUND_IN_ROSTER,
            )
        if champion_user.game_account_id != game_account_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=CHAMPION_NOT_BELONG_TO_PLAYER,
            )

        # 2. Verify game_account is in the alliance and in this battlegroup
        game_account = await session.get(GameAccount, game_account_id)
        if game_account is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=GAME_ACCOUNT_NOT_FOUND,
            )
        if game_account.alliance_id != alliance_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=PLAYER_NOT_IN_ALLIANCE,
            )
        if game_account.alliance_group != battlegroup:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=PLAYER_NOT_IN_BATTLEGROUP,
            )

        # 3. Check node is not already occupied (replace if so)
        existing_node = await session.exec(
            select(DefensePlacement).where(
                and_(
                    DefensePlacement.alliance_id == alliance_id,
                    DefensePlacement.battlegroup == battlegroup,
                    DefensePlacement.node_number == node_number,
                )
            )
        )
        old_placement = existing_node.first()
        if old_placement:
            await session.delete(old_placement)
            await session.flush()

        # 4. Check champion (by champion_id) is not already placed elsewhere on this defense
        existing_champ = await session.exec(
            select(DefensePlacement)
            .join(ChampionUser, DefensePlacement.champion_user_id == ChampionUser.id)  # type: ignore[arg-type]
            .where(
                and_(
                    DefensePlacement.alliance_id == alliance_id,
                    DefensePlacement.battlegroup == battlegroup,
                    ChampionUser.champion_id == champion_user.champion_id,
                )
            )
        )
        if existing_champ.first():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=CHAMPION_ALREADY_PLACED_OTHER_NODE,
            )

        # 5. Check max defenders per player (5)
        player_count_result = await session.exec(
            select(DefensePlacement).where(
                and_(
                    DefensePlacement.alliance_id == alliance_id,
                    DefensePlacement.battlegroup == battlegroup,
                    DefensePlacement.game_account_id == game_account_id,
                )
            )
        )
        player_placements = player_count_result.all()
        if len(player_placements) >= MAX_DEFENDERS_PER_PLAYER:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=player_max_defenders_reached(MAX_DEFENDERS_PER_PLAYER),
            )

        # 6. Create the placement
        placement = DefensePlacement(
            alliance_id=alliance_id,
            battlegroup=battlegroup,
            node_number=node_number,
            champion_user_id=champion_user_id,
            game_account_id=game_account_id,
            placed_by_id=placed_by_id,
        )
        session.add(placement)
        await session.commit()
        await session.refresh(placement)

        # Reload with relations
        return await cls._load_placement(session, placement.id)

    @classmethod
    async def _load_placement(
        cls, session: SessionDep, placement_id: uuid.UUID
    ) -> DefensePlacement:
        stmt = (
            select(DefensePlacement)
            .where(DefensePlacement.id == placement_id)
            .options(
                selectinload(DefensePlacement.champion_user).selectinload(ChampionUser.champion),  # type: ignore[arg-type]
                selectinload(DefensePlacement.game_account),  # type: ignore[arg-type]
                selectinload(DefensePlacement.placed_by),  # type: ignore[arg-type]
            )
        )
        result = await session.exec(stmt)
        return result.one()

    @classmethod
    async def remove_defender(
        cls,
        session: SessionDep,
        alliance_id: uuid.UUID,
        battlegroup: int,
        node_number: int,
    ) -> None:
        """Remove a defender from a specific node."""
        stmt = select(DefensePlacement).where(
            and_(
                DefensePlacement.alliance_id == alliance_id,
                DefensePlacement.battlegroup == battlegroup,
                DefensePlacement.node_number == node_number,
            )
        )
        result = await session.exec(stmt)
        placement = result.first()
        if placement is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=NO_DEFENDER_ON_NODE,
            )
        await session.delete(placement)
        await session.commit()

    @classmethod
    async def clear_defense(
        cls,
        session: SessionDep,
        alliance_id: uuid.UUID,
        battlegroup: int,
    ) -> int:
        """Clear all defense placements for a battlegroup. Returns count deleted."""
        stmt = select(DefensePlacement).where(
            and_(
                DefensePlacement.alliance_id == alliance_id,
                DefensePlacement.battlegroup == battlegroup,
            )
        )
        result = await session.exec(stmt)
        placements = result.all()
        count = len(placements)
        for p in placements:
            await session.delete(p)
        await session.commit()
        return count

    @classmethod
    async def _get_defender_counts(
        cls, session: SessionDep, alliance_id: uuid.UUID, battlegroup: int
    ) -> dict[uuid.UUID, int]:
        """Return a mapping of game_account_id → number of defenders placed in this battlegroup."""
        result = await session.exec(
            select(DefensePlacement).where(
                and_(
                    DefensePlacement.alliance_id == alliance_id,
                    DefensePlacement.battlegroup == battlegroup,
                )
            )
        )
        counts: dict[uuid.UUID, int] = {}
        for p in result.all():
            counts[p.game_account_id] = counts.get(p.game_account_id, 0) + 1
        return counts

    @classmethod
    async def get_available_champions(
        cls,
        session: SessionDep,
        alliance_id: uuid.UUID,
        battlegroup: int,
    ) -> list[dict]:
        """Get all champions from BG members that are NOT already placed.
        Groups by champion, showing which players own it and at what rarity.
        Prefers 7 over 6."""
        # Get all members in this BG
        members_result = await session.exec(
            select(GameAccount).where(
                and_(
                    GameAccount.alliance_id == alliance_id,
                    GameAccount.alliance_group == battlegroup,
                )
            )
        )
        members = members_result.all()
        if not members:
            return []

        member_ids = [m.id for m in members]
        member_map = {m.id: m for m in members}

        # Get all champion_users for these members
        roster_stmt = (
            select(ChampionUser)
            .where(ChampionUser.game_account_id.in_(member_ids))  # type: ignore[attr-defined]
            .options(selectinload(ChampionUser.champion))  # type: ignore[arg-type]
        )
        roster_result = await session.exec(roster_stmt)
        all_roster = roster_result.all()

        # Get already-placed champion_ids (by champion, not champion_user)
        # A champion placed by ANY player blocks the champion for everyone
        placed_cu_stmt = (
            select(ChampionUser.champion_id)
            .join(DefensePlacement, DefensePlacement.champion_user_id == ChampionUser.id)  # type: ignore[arg-type]
            .where(
                and_(
                    DefensePlacement.alliance_id == alliance_id,
                    DefensePlacement.battlegroup == battlegroup,
                )
            )
        )
        placed_cu_result = await session.exec(placed_cu_stmt)
        placed_champion_ids = set(placed_cu_result.all())

        # Get defender counts per player
        defender_counts = await cls._get_defender_counts(session, alliance_id, battlegroup)

        # Group by champion_id
        champion_groups: dict[uuid.UUID, dict] = {}
        for cu in all_roster:
            # Exclude if this champion (by champion_id) is already placed anywhere on the map
            if cu.champion_id in placed_champion_ids:
                continue
            # Skip players who already have 5 defenders
            if defender_counts.get(cu.game_account_id, 0) >= MAX_DEFENDERS_PER_PLAYER:
                continue

            champ_id = cu.champion_id
            if champ_id not in champion_groups:
                champion_groups[champ_id] = {
                    "champion_id": str(champ_id),
                    "champion_name": cu.champion.name,
                    "champion_alias": cu.champion.alias,
                    "champion_class": cu.champion.champion_class,
                    "is_saga_attacker": cu.champion.is_saga_attacker,
                    "is_saga_defender": cu.champion.is_saga_defender,
                    "image_url": cu.champion.image_url,
                    "owners": [],
                }
            champion_groups[champ_id]["owners"].append(
                {
                    "champion_user_id": str(cu.id),
                    "game_account_id": str(cu.game_account_id),
                    "game_pseudo": member_map[cu.game_account_id].game_pseudo,
                    "rarity": cu.rarity,
                    "stars": cu.stars,
                    "rank": cu.rank,
                    "signature": cu.signature,
                    "is_preferred_attacker": cu.is_preferred_attacker,
                    "ascension": cu.ascension,
                    "defender_count": defender_counts.get(cu.game_account_id, 0),
                }
            )

        # Sort owners: prefer 7 over 6, then higher rank, then fewer defenders already placed
        for group in champion_groups.values():
            group["owners"].sort(key=lambda o: (-o["stars"], -o["rank"], o["defender_count"]))

        # Sort champions alphabetically
        result = sorted(champion_groups.values(), key=lambda g: g["champion_name"])
        return result

    @classmethod
    async def get_bg_members_with_counts(
        cls,
        session: SessionDep,
        alliance_id: uuid.UUID,
        battlegroup: int,
    ) -> list[dict]:
        """Get all members in a battlegroup with their defender counts."""
        members_result = await session.exec(
            select(GameAccount).where(
                and_(
                    GameAccount.alliance_id == alliance_id,
                    GameAccount.alliance_group == battlegroup,
                )
            )
        )
        members = members_result.all()

        defender_counts = await cls._get_defender_counts(session, alliance_id, battlegroup)

        # Fetch alliance to determine the owner
        alliance = await session.get(Alliance, alliance_id)
        owner_game_account_id: uuid.UUID | None = alliance.owner_id if alliance else None

        # Fetch officers for this alliance
        officers_result = await session.exec(
            select(AllianceOfficer).where(AllianceOfficer.alliance_id == alliance_id)
        )
        officer_ids: set[uuid.UUID] = {o.game_account_id for o in officers_result.all()}

        return [
            {
                "game_account_id": str(m.id),
                "game_pseudo": m.game_pseudo,
                "defender_count": defender_counts.get(m.id, 0),
                "max_defenders": MAX_DEFENDERS_PER_PLAYER,
                "is_owner": m.id == owner_game_account_id,
                "is_officer": m.id in officer_ids,
            }
            for m in members
        ]

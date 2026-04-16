import uuid
from typing import Optional

from fastapi import HTTPException
from sqlmodel import select, and_
from sqlalchemy.orm import selectinload
from starlette import status

from src.models.Alliance import Alliance
from src.models.AllianceOfficer import AllianceOfficer
from src.models.Champion import Champion
from src.models.ChampionUser import ChampionUser
from src.models.DefensePlacement import DefensePlacement
from src.models.GameAccount import GameAccount
from src.dto.dto_defense import DefenseExportItem, DefenseImportError, DefenseReportItem
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
        Prefers 7★ over 6★."""
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
            champion_groups[champ_id]["owners"].append({
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
            })

        # Sort owners: prefer 7★ over 6★, then higher rank, then fewer defenders already placed
        for group in champion_groups.values():
            group["owners"].sort(
                key=lambda o: (-o["stars"], -o["rank"], o["defender_count"])
            )

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

    # ─── Export / Import ──────────────────────────────────────────────────

    @classmethod
    async def export_defense(
        cls,
        session: SessionDep,
        alliance_id: uuid.UUID,
        battlegroup: int,
    ) -> list[DefenseExportItem]:
        """Return current placements as portable items (no IDs)."""
        placements = await cls.get_defense(session, alliance_id, battlegroup)
        return [
            DefenseExportItem(
                champion_name=p.champion_user.champion.name,
                rarity=p.champion_user.rarity,
                node_number=p.node_number,
                owner_name=p.game_account.game_pseudo,
            )
            for p in placements
        ]

    @classmethod
    async def _report_snapshot(
        cls,
        session: SessionDep,
        alliance_id: uuid.UUID,
        battlegroup: int,
    ) -> list[DefenseReportItem]:
        """Return current placements as rich report items (with class + image)."""
        placements = await cls.get_defense(session, alliance_id, battlegroup)
        return [
            DefenseReportItem(
                champion_name=p.champion_user.champion.name,
                champion_class=p.champion_user.champion.champion_class,
                champion_image_url=p.champion_user.champion.image_url,
                rarity=p.champion_user.rarity,
                node_number=p.node_number,
                owner_name=p.game_account.game_pseudo,
            )
            for p in placements
        ]

    @classmethod
    async def import_defense(
        cls,
        session: SessionDep,
        alliance_id: uuid.UUID,
        battlegroup: int,
        items: list[DefenseExportItem],
        placed_by_id: uuid.UUID | None = None,
    ) -> tuple[list[DefenseReportItem], list[DefenseReportItem], list[DefenseImportError], int, int]:
        """
        Import a defense layout.

        Returns (before, after, errors, success_count, error_count).
        """
        # 1. Snapshot "before" (rich)
        before = await cls._report_snapshot(session, alliance_id, battlegroup)

        # 2. Clear current defense
        await cls.clear_defense(session, alliance_id, battlegroup)

        # 3. Pre-load lookup tables for this BG
        members_result = await session.exec(
            select(GameAccount).where(
                and_(
                    GameAccount.alliance_id == alliance_id,
                    GameAccount.alliance_group == battlegroup,
                )
            )
        )
        members = members_result.all()
        pseudo_map: dict[str, GameAccount] = {m.game_pseudo.lower(): m for m in members}

        champion_result = await session.exec(select(Champion))
        all_champions = champion_result.all()
        champ_name_map: dict[str, Champion] = {c.name.lower(): c for c in all_champions}

        # 4. Import one-by-one
        errors: list[DefenseImportError] = []
        success_count = 0

        for item in items:
            reason = await cls._import_one(
                session,
                alliance_id,
                battlegroup,
                item,
                pseudo_map,
                champ_name_map,
                placed_by_id,
            )
            if reason:
                errors.append(
                    DefenseImportError(
                        node_number=item.node_number,
                        champion_name=item.champion_name,
                        owner_name=item.owner_name,
                        reason=reason,
                    )
                )
            else:
                success_count += 1

        await session.commit()

        # 5. Snapshot "after" (rich)
        after = await cls._report_snapshot(session, alliance_id, battlegroup)

        return before, after, errors, success_count, len(errors)

    @classmethod
    async def _import_one(
        cls,
        session: SessionDep,
        alliance_id: uuid.UUID,
        battlegroup: int,
        item: DefenseExportItem,
        pseudo_map: dict[str, "GameAccount"],
        champ_name_map: dict[str, "Champion"],
        placed_by_id: uuid.UUID | None,
    ) -> str | None:
        """Try to place one imported item. Returns error reason or None on success."""
        # Validate node
        if item.node_number < 1 or item.node_number > 55:
            return f"Invalid node number {item.node_number}"

        # Resolve champion
        champion = champ_name_map.get(item.champion_name.lower())
        if champion is None:
            return f"Unknown champion '{item.champion_name}'"

        # Resolve owner
        game_account = pseudo_map.get(item.owner_name.lower())
        if game_account is None:
            return f"Player '{item.owner_name}' not found in BG{battlegroup}"

        # Parse rarity → stars + rank
        try:
            parts = item.rarity.lower().split("r")
            stars = int(parts[0])
            rank = int(parts[1])
        except (ValueError, IndexError):
            return f"Invalid rarity format '{item.rarity}' (expected e.g. '7r3')"

        # Find matching ChampionUser
        cu_result = await session.exec(
            select(ChampionUser).where(
                and_(
                    ChampionUser.champion_id == champion.id,
                    ChampionUser.game_account_id == game_account.id,
                    ChampionUser.stars == stars,
                    ChampionUser.rank == rank,
                )
            )
        )
        champion_user = cu_result.first()
        if champion_user is None:
            # Try any matching champion for this owner (different rank)
            fallback_result = await session.exec(
                select(ChampionUser).where(
                    and_(
                        ChampionUser.champion_id == champion.id,
                        ChampionUser.game_account_id == game_account.id,
                    )
                )
            )
            fallback = fallback_result.first()
            if fallback is None:
                return f"'{item.owner_name}' does not own '{item.champion_name}'"
            else:
                return (
                    f"'{item.owner_name}' owns '{item.champion_name}' at "
                    f"{fallback.rarity}, not {item.rarity}"
                )

        # Check node not already taken (earlier import item may occupy it)
        node_result = await session.exec(
            select(DefensePlacement).where(
                and_(
                    DefensePlacement.alliance_id == alliance_id,
                    DefensePlacement.battlegroup == battlegroup,
                    DefensePlacement.node_number == item.node_number,
                )
            )
        )
        if node_result.first():
            return f"Node {item.node_number} already occupied by a previous import entry"

        # Check champion not already placed on another node
        dup_result = await session.exec(
            select(DefensePlacement)
            .join(ChampionUser, DefensePlacement.champion_user_id == ChampionUser.id)
            .where(
                and_(
                    DefensePlacement.alliance_id == alliance_id,
                    DefensePlacement.battlegroup == battlegroup,
                    ChampionUser.champion_id == champion.id,
                )
            )
        )
        if dup_result.first():
            return f"Champion '{item.champion_name}' already placed on another node"

        # Check max 5 per player
        count_result = await session.exec(
            select(DefensePlacement).where(
                and_(
                    DefensePlacement.alliance_id == alliance_id,
                    DefensePlacement.battlegroup == battlegroup,
                    DefensePlacement.game_account_id == game_account.id,
                )
            )
        )
        if len(count_result.all()) >= MAX_DEFENDERS_PER_PLAYER:
            return f"'{item.owner_name}' already has {MAX_DEFENDERS_PER_PLAYER} defenders"

        # All checks passed — create the placement
        placement = DefensePlacement(
            alliance_id=alliance_id,
            battlegroup=battlegroup,
            node_number=item.node_number,
            champion_user_id=champion_user.id,
            game_account_id=game_account.id,
            placed_by_id=placed_by_id,
        )
        session.add(placement)
        await session.flush()

        return None

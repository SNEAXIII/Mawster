import uuid
from collections import Counter

from fastapi import HTTPException
from sqlalchemy.orm import selectinload
from sqlmodel import select
from starlette import status

from src.Messages.defense_messages import (
    CHAMPION_ALREADY_PLACED_OTHER_NODE,
    CHAMPION_NOT_BELONG_TO_PLAYER,
    CHAMPION_NOT_FOUND_IN_ROSTER,
    GAME_ACCOUNT_NOT_FOUND,
    NO_DEFENDER_ON_NODE,
    PLAYER_NOT_IN_ALLIANCE,
    PLAYER_NOT_IN_BATTLEGROUP,
    node_exceeds_map,
    player_max_defenders_reached,
)
from src.models.alliance.Alliance import Alliance
from src.models.alliance.AllianceOfficer import AllianceOfficer
from src.models.alliance.AllianceStrategist import AllianceStrategist
from src.models.alliance.DefensePlacement import DefensePlacement
from src.models.champion.ChampionUser import ChampionUser
from src.models.user.GameAccount import GameAccount
from src.services.admin.SagaService import SagaService
from src.services.admin.SeasonService import SeasonService
from src.services.alliance.war.WarFormatConfig import for_format
from src.utils.db import SessionDep

_PLACEMENT_OPTIONS = (
    selectinload(DefensePlacement.champion_user).selectinload(ChampionUser.champion),  # type: ignore[arg-type]
    selectinload(DefensePlacement.game_account),  # type: ignore[arg-type]
    selectinload(DefensePlacement.placed_by),  # type: ignore[arg-type]
)


def _in_bg(alliance_id: uuid.UUID, battlegroup: int):
    return DefensePlacement.alliance_id == alliance_id, DefensePlacement.battlegroup == battlegroup


class DefensePlacementService:
    @classmethod
    async def get_defense(
        cls, session: SessionDep, alliance_id: uuid.UUID, battlegroup: int
    ) -> list[DefensePlacement]:
        """Get all defense placements for a battlegroup."""
        result = await session.exec(
            select(DefensePlacement)
            .where(*_in_bg(alliance_id, battlegroup))
            .options(*_PLACEMENT_OPTIONS)
        )
        return result.all()

    @staticmethod
    async def _placement_on_node(
        session: SessionDep, alliance_id: uuid.UUID, battlegroup: int, node_number: int
    ) -> DefensePlacement | None:
        result = await session.exec(
            select(DefensePlacement).where(
                *_in_bg(alliance_id, battlegroup), DefensePlacement.node_number == node_number
            )
        )
        return result.first()

    @classmethod
    async def place_defender(
        cls,
        session: SessionDep,
        alliance_id: uuid.UUID,
        battlegroup: int,
        node_number: int,
        champion_user_id: uuid.UUID,
        game_account_id: uuid.UUID,
        placed_by_id: uuid.UUID | None = None,
    ) -> DefensePlacement:
        """Place a defender on a node, replacing whoever held it. Validates all business rules."""
        params = for_format(await SeasonService.get_current_format(session))
        if node_number < 1 or node_number > params.node_count:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT, node_exceeds_map(params.node_count)
            )

        champion_user = await session.get(ChampionUser, champion_user_id)
        if champion_user is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, CHAMPION_NOT_FOUND_IN_ROSTER)
        if champion_user.game_account_id != game_account_id:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, CHAMPION_NOT_BELONG_TO_PLAYER)

        game_account = await session.get(GameAccount, game_account_id)
        if game_account is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, GAME_ACCOUNT_NOT_FOUND)
        if game_account.alliance_id != alliance_id:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, PLAYER_NOT_IN_ALLIANCE)
        if game_account.alliance_group != battlegroup:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, PLAYER_NOT_IN_BATTLEGROUP)

        old_placement = await cls._placement_on_node(session, alliance_id, battlegroup, node_number)
        if old_placement:
            await session.delete(old_placement)
            await session.flush()

        # A champion blocks the whole map, whichever player owns the copy on it.
        same_champion = await session.exec(
            select(DefensePlacement)
            .join(ChampionUser, DefensePlacement.champion_user_id == ChampionUser.id)  # type: ignore[arg-type]
            .where(
                *_in_bg(alliance_id, battlegroup),
                ChampionUser.champion_id == champion_user.champion_id,
            )
        )
        if same_champion.first():
            raise HTTPException(status.HTTP_409_CONFLICT, CHAMPION_ALREADY_PLACED_OTHER_NODE)

        counts = await cls._get_defender_counts(session, alliance_id, battlegroup)
        if counts[game_account_id] >= params.max_defenders_per_player:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                player_max_defenders_reached(params.max_defenders_per_player),
            )

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
        result = await session.exec(
            select(DefensePlacement)
            .where(DefensePlacement.id == placement.id)
            .options(*_PLACEMENT_OPTIONS)
        )
        return result.one()

    @classmethod
    async def remove_defender(
        cls, session: SessionDep, alliance_id: uuid.UUID, battlegroup: int, node_number: int
    ) -> None:
        """Remove a defender from a specific node."""
        placement = await cls._placement_on_node(session, alliance_id, battlegroup, node_number)
        if placement is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, NO_DEFENDER_ON_NODE)
        await session.delete(placement)
        await session.commit()

    @classmethod
    async def remove_placements_for_member(
        cls, session: SessionDep, alliance_id: uuid.UUID, game_account_id: uuid.UUID
    ) -> int:
        """Free every node a leaving or kicked member held. Flushes, never commits: the caller
        owns the transaction. Returns the number of placements deleted."""
        result = await session.exec(
            select(DefensePlacement).where(
                DefensePlacement.alliance_id == alliance_id,
                DefensePlacement.game_account_id == game_account_id,
            )
        )
        placements = result.all()
        for p in placements:
            await session.delete(p)
        await session.flush()
        return len(placements)

    @classmethod
    async def clear_defense(
        cls, session: SessionDep, alliance_id: uuid.UUID, battlegroup: int
    ) -> int:
        """Clear all defense placements for a battlegroup. Returns count deleted."""
        result = await session.exec(
            select(DefensePlacement).where(*_in_bg(alliance_id, battlegroup))
        )
        placements = result.all()
        for p in placements:
            await session.delete(p)
        await session.commit()
        return len(placements)

    @staticmethod
    async def _get_defender_counts(
        session: SessionDep, alliance_id: uuid.UUID, battlegroup: int
    ) -> Counter[uuid.UUID]:
        """game_account_id → number of defenders placed in this battlegroup."""
        result = await session.exec(
            select(DefensePlacement.game_account_id).where(*_in_bg(alliance_id, battlegroup))
        )
        return Counter(result.all())

    @staticmethod
    async def _bg_members(
        session: SessionDep, alliance_id: uuid.UUID, battlegroup: int
    ) -> list[GameAccount]:
        result = await session.exec(
            select(GameAccount).where(
                GameAccount.alliance_id == alliance_id, GameAccount.alliance_group == battlegroup
            )
        )
        return result.all()

    @classmethod
    async def get_available_champions(
        cls, session: SessionDep, alliance_id: uuid.UUID, battlegroup: int
    ) -> list[dict]:
        """BG members' champions not yet on the map, grouped by champion, best owner first."""
        members = await cls._bg_members(session, alliance_id, battlegroup)
        if not members:
            return []
        member_map = {m.id: m for m in members}

        roster = (
            await session.exec(
                select(ChampionUser)
                .where(ChampionUser.game_account_id.in_(member_map))  # type: ignore[attr-defined]
                .options(selectinload(ChampionUser.champion))  # type: ignore[arg-type]
            )
        ).all()
        # A champion placed by ANY player blocks the champion for everyone.
        placed_champion_ids = set(
            (
                await session.exec(
                    select(ChampionUser.champion_id)
                    .join(DefensePlacement, DefensePlacement.champion_user_id == ChampionUser.id)  # type: ignore[arg-type]
                    .where(*_in_bg(alliance_id, battlegroup))
                )
            ).all()
        )
        params = for_format(await SeasonService.get_current_format(session))
        defender_counts = await cls._get_defender_counts(session, alliance_id, battlegroup)
        saga = await SagaService.resolve_current(session)

        champion_groups: dict[uuid.UUID, dict] = {}
        for cu in roster:
            if cu.champion_id in placed_champion_ids:
                continue
            if defender_counts[cu.game_account_id] >= params.max_defenders_per_player:
                continue
            if cu.champion_id not in champion_groups:
                is_saga_attacker, is_saga_defender = saga.get(cu.champion_id, (False, False))
                champion_groups[cu.champion_id] = {
                    "champion_id": str(cu.champion_id),
                    "champion_name": cu.champion.name,
                    "champion_alias": cu.champion.alias,
                    "champion_class": cu.champion.champion_class,
                    "is_saga_attacker": is_saga_attacker,
                    "is_saga_defender": is_saga_defender,
                    "image_url": cu.champion.image_url,
                    "owners": [],
                }
            champion_groups[cu.champion_id]["owners"].append(
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
                    "defender_count": defender_counts[cu.game_account_id],
                }
            )

        # Owners: 7 stars over 6, then higher rank, then fewer defenders already placed.
        for group in champion_groups.values():
            group["owners"].sort(key=lambda o: (-o["stars"], -o["rank"], o["defender_count"]))
        return sorted(champion_groups.values(), key=lambda g: g["champion_name"])

    @classmethod
    async def get_bg_members_with_counts(
        cls, session: SessionDep, alliance_id: uuid.UUID, battlegroup: int
    ) -> list[dict]:
        """Get all members in a battlegroup with their defender counts."""
        members = await cls._bg_members(session, alliance_id, battlegroup)
        defender_counts = await cls._get_defender_counts(session, alliance_id, battlegroup)
        params = for_format(await SeasonService.get_current_format(session))
        alliance = await session.get(Alliance, alliance_id)
        owner_id = alliance.owner_id if alliance else None

        async def rank_ids(model: type[AllianceOfficer] | type[AllianceStrategist]) -> set:
            result = await session.exec(
                select(model.game_account_id).where(model.alliance_id == alliance_id)
            )
            return set(result.all())

        officer_ids = await rank_ids(AllianceOfficer)
        strategist_ids = await rank_ids(AllianceStrategist)
        return [
            {
                "game_account_id": str(m.id),
                "game_pseudo": m.game_pseudo,
                "defender_count": defender_counts[m.id],
                "max_defenders": params.max_defenders_per_player,
                "is_owner": m.id == owner_id,
                "is_officer": m.id in officer_ids,
                "is_strategist": m.id in strategist_ids,
            }
            for m in members
        ]

import uuid
from typing import Optional

from fastapi import HTTPException
from sqlmodel import select, and_
from sqlalchemy.orm import selectinload
from starlette import status

from src.models.Champion import Champion
from src.models.ChampionUser import ChampionUser
from src.models.DefensePlacement import DefensePlacement
from src.models.GameAccount import GameAccount
from src.models.War import War, WarStatus
from src.models.WarDefensePlacement import WarDefensePlacement
from src.dto.dto_war import (
    WarResponse,
    WarPlacementCreateRequest,
    WarPlacementResponse,
    WarDefenseSummaryResponse,
    AvailableAttackerResponse,
)
from src.utils.db import SessionDep


class WarService:

    @classmethod
    async def create_war(
        cls,
        session: SessionDep,
        alliance_id: uuid.UUID,
        opponent_name: str,
        created_by_id: uuid.UUID,
    ) -> WarResponse:
        existing = await session.exec(
            select(War).where(War.alliance_id == alliance_id, War.status == WarStatus.active)
        )
        if existing.first() is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An active war already exists for this alliance",
            )
        war = War(
            alliance_id=alliance_id,
            opponent_name=opponent_name,
            created_by_id=created_by_id,
        )
        session.add(war)
        await session.commit()
        await session.refresh(war)
        return WarResponse.model_validate(await cls._load_war(session, war.id))

    @classmethod
    async def get_wars(
        cls,
        session: SessionDep,
        alliance_id: uuid.UUID,
    ) -> list[WarResponse]:
        stmt = (
            select(War)
            .where(War.alliance_id == alliance_id)
            .options(selectinload(War.created_by))  # type: ignore[arg-type]
            .order_by(War.created_at.desc())  # type: ignore[attr-defined]
        )
        result = await session.exec(stmt)
        wars = result.all()
        return [WarResponse.model_validate(w) for w in wars]

    @classmethod
    async def get_current_war(
        cls,
        session: SessionDep,
        alliance_id: uuid.UUID,
    ) -> WarResponse:
        result = await session.exec(
            select(War).where(War.alliance_id == alliance_id, War.status == WarStatus.active)
        )
        war = result.first()
        if war is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No active war for this alliance",
            )
        return WarResponse.model_validate(await cls._load_war(session, war.id))

    @classmethod
    async def get_war(
        cls,
        session: SessionDep,
        war_id: uuid.UUID,
        alliance_id: uuid.UUID,
    ) -> War:
        war = await cls._load_war(session, war_id)
        if war is None or war.alliance_id != alliance_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="War not found")
        return war

    @classmethod
    async def _load_war(cls, session: SessionDep, war_id: uuid.UUID) -> Optional[War]:
        stmt = (
            select(War)
            .where(War.id == war_id)
            .options(selectinload(War.created_by))  # type: ignore[arg-type]
        )
        result = await session.exec(stmt)
        return result.first()

    @classmethod
    async def get_war_defense(
        cls,
        session: SessionDep,
        war_id: uuid.UUID,
        battlegroup: int,
    ) -> WarDefenseSummaryResponse:
        placements = await cls._get_placements(session, war_id, battlegroup)
        return WarDefenseSummaryResponse(
            war_id=war_id,
            battlegroup=battlegroup,
            placements=[WarPlacementResponse.model_validate(p) for p in placements],
        )

    @classmethod
    async def _get_placements(
        cls,
        session: SessionDep,
        war_id: uuid.UUID,
        battlegroup: int,
    ) -> list[WarDefensePlacement]:
        stmt = (
            select(WarDefensePlacement)
            .where(
                and_(
                    WarDefensePlacement.war_id == war_id,
                    WarDefensePlacement.battlegroup == battlegroup,
                )
            )
            .options(
                selectinload(WarDefensePlacement.champion),  # type: ignore[arg-type]
                selectinload(WarDefensePlacement.placed_by),  # type: ignore[arg-type]
                selectinload(WarDefensePlacement.attacker_champion_user).selectinload(ChampionUser.champion),  # type: ignore[arg-type]
                selectinload(WarDefensePlacement.attacker_champion_user).selectinload(ChampionUser.game_account),  # type: ignore[arg-type]
            )
        )
        result = await session.exec(stmt)
        return result.all()

    @classmethod
    async def _load_placement(
        cls, session: SessionDep, placement_id: uuid.UUID
    ) -> WarDefensePlacement:
        stmt = (
            select(WarDefensePlacement)
            .where(WarDefensePlacement.id == placement_id)
            .options(
                selectinload(WarDefensePlacement.champion),  # type: ignore[arg-type]
                selectinload(WarDefensePlacement.placed_by),  # type: ignore[arg-type]
                selectinload(WarDefensePlacement.attacker_champion_user).selectinload(ChampionUser.champion),  # type: ignore[arg-type]
                selectinload(WarDefensePlacement.attacker_champion_user).selectinload(ChampionUser.game_account),  # type: ignore[arg-type]
            )
        )
        result = await session.exec(stmt)
        return result.one()

    @classmethod
    async def _get_placement_by_node(
        cls,
        session: SessionDep,
        war_id: uuid.UUID,
        battlegroup: int,
        node_number: int,
    ) -> Optional[WarDefensePlacement]:
        result = await session.exec(
            select(WarDefensePlacement).where(
                and_(
                    WarDefensePlacement.war_id == war_id,
                    WarDefensePlacement.battlegroup == battlegroup,
                    WarDefensePlacement.node_number == node_number,
                )
            )
        )
        return result.first()

    @classmethod
    async def place_defender(
        cls,
        session: SessionDep,
        war_id: uuid.UUID,
        battlegroup: int,
        placement_request: WarPlacementCreateRequest,
        placed_by_id: uuid.UUID,
    ) -> WarPlacementResponse:
        # Validate champion exists
        champion = await session.get(Champion, placement_request.champion_id)
        if champion is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Champion not found")

        # Check champion not already placed as defender in this BG
        existing_champ = await session.exec(
            select(WarDefensePlacement).where(
                and_(
                    WarDefensePlacement.war_id == war_id,
                    WarDefensePlacement.battlegroup == battlegroup,
                    WarDefensePlacement.champion_id == placement_request.champion_id,
                    WarDefensePlacement.node_number != placement_request.node_number,
                )
            )
        )
        if existing_champ.first():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This champion is already placed on another node in this battlegroup",
            )

        # Replace if node already occupied
        existing_node = await session.exec(
            select(WarDefensePlacement).where(
                and_(
                    WarDefensePlacement.war_id == war_id,
                    WarDefensePlacement.battlegroup == battlegroup,
                    WarDefensePlacement.node_number == placement_request.node_number,
                )
            )
        )
        old_placement = existing_node.first()
        if old_placement:
            await session.delete(old_placement)
            await session.flush()

        placement = WarDefensePlacement(
            war_id=war_id,
            battlegroup=battlegroup,
            node_number=placement_request.node_number,
            champion_id=placement_request.champion_id,
            stars=placement_request.stars,
            rank=placement_request.rank,
            ascension=placement_request.ascension,
            placed_by_id=placed_by_id,
        )
        session.add(placement)
        await session.commit()
        await session.refresh(placement)

        return WarPlacementResponse.model_validate(
            await cls._load_placement(session, placement.id)
        )

    @classmethod
    async def remove_defender(
        cls,
        session: SessionDep,
        war_id: uuid.UUID,
        battlegroup: int,
        node_number: int,
    ) -> None:
        result = await session.exec(
            select(WarDefensePlacement).where(
                and_(
                    WarDefensePlacement.war_id == war_id,
                    WarDefensePlacement.battlegroup == battlegroup,
                    WarDefensePlacement.node_number == node_number,
                )
            )
        )
        placement = result.first()
        if placement is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No defender on this node",
            )
        await session.delete(placement)
        await session.commit()

    @classmethod
    async def end_war(
        cls,
        session: SessionDep,
        war_id: uuid.UUID,
        alliance_id: uuid.UUID,
    ) -> WarResponse:
        war = await cls.get_war(session, war_id, alliance_id)
        war.status = WarStatus.ended
        session.add(war)
        await session.commit()
        await session.refresh(war)
        return WarResponse.model_validate(await cls._load_war(session, war.id))

    @classmethod
    async def clear_bg(
        cls,
        session: SessionDep,
        war_id: uuid.UUID,
        battlegroup: int,
    ) -> int:
        result = await session.exec(
            select(WarDefensePlacement).where(
                and_(
                    WarDefensePlacement.war_id == war_id,
                    WarDefensePlacement.battlegroup == battlegroup,
                )
            )
        )
        placements = result.all()
        count = len(placements)
        for p in placements:
            await session.delete(p)
        await session.commit()
        return count

    # ─── Attacker endpoints ───────────────────────────────────────────────────

    @classmethod
    async def get_available_attackers(
        cls,
        session: SessionDep,
        war_id: uuid.UUID,
        alliance_id: uuid.UUID,
        battlegroup: int,
    ) -> list[AvailableAttackerResponse]:
        # Get members assigned to this battlegroup
        members_result = await session.exec(
            select(GameAccount)
            .where(
                and_(
                    GameAccount.alliance_id == alliance_id,
                    GameAccount.alliance_group == battlegroup,
                )
            )
            .options(
                selectinload(GameAccount.roster).selectinload(ChampionUser.champion),  # type: ignore[arg-type]
            )
        )
        members = members_result.all()

        # Get champion_user_ids already placed in regular defense for members currently in this BG.
        defense_result = await session.exec(
            select(DefensePlacement.champion_user_id)
            .join(GameAccount, DefensePlacement.game_account_id == GameAccount.id)
            .where(
                and_(
                    DefensePlacement.alliance_id == alliance_id,
                    GameAccount.alliance_group == battlegroup,
                )
            )
        )
        defense_champion_user_ids = set(defense_result.all())
        result: list[AvailableAttackerResponse] = []
        for game_account in members:
            for champion_user in game_account.roster:
                # Remove a champion if a user already placed it in defense
                if champion_user.id in defense_champion_user_ids:
                    continue
                result.append(AvailableAttackerResponse(
                    champion_user_id=champion_user.id,
                    game_account_id=game_account.id,
                    game_pseudo=game_account.game_pseudo,
                    champion_id=champion_user.champion_id,
                    champion_name=champion_user.champion.name,
                    champion_class=champion_user.champion.champion_class,
                    image_url=champion_user.champion.image_url,
                    rarity=champion_user.rarity,
                ))
        return result

    @classmethod
    async def assign_attacker(
        cls,
        session: SessionDep,
        war_id: uuid.UUID,
        alliance_id: uuid.UUID,
        battlegroup: int,
        node_number: int,
        champion_user_id: uuid.UUID,
    ) -> WarPlacementResponse:
        # 1. Node must have a defender
        placement = await cls._get_placement_by_node(session, war_id, battlegroup, node_number)
        if placement is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="This node has no defender — place a defender first",
            )

        # 2. Load the champion user
        champion_user_stmt = (
            select(ChampionUser)
            .where(ChampionUser.id == champion_user_id)
            .options(selectinload(ChampionUser.game_account))  # type: ignore[arg-type]
        )
        champion_user = (await session.exec(champion_user_stmt)).first()
        if champion_user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Champion user not found")

        game_account = champion_user.game_account
        # 3. Validate member belongs to this alliance + battlegroup
        if game_account.alliance_id != alliance_id or game_account.alliance_group != battlegroup:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This champion does not belong to a member of this alliance battlegroup",
            )

        # 4. Check champion not already used as defender in this BG
        all_placements = await cls._get_placements(session, war_id, battlegroup)
        defender_champion_ids = {p.champion_id for p in all_placements}
        if champion_user.champion_id in defender_champion_ids:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This champion is already placed as a defender in this battlegroup",
            )

        # 5. Check champion not already placed in regular alliance defense
        defense_check = await session.exec(
            select(DefensePlacement).where(
                and_(
                    DefensePlacement.champion_user_id == champion_user_id,
                    DefensePlacement.alliance_id == alliance_id,
                    DefensePlacement.battlegroup == battlegroup,
                )
            )
        )
        if defense_check.first():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This champion is already placed in the alliance defense",
            )

        # 7. Check member has fewer than 3 attackers in this war+BG.
        # Use a direct DB query instead of relying on selectinload being populated on all placements.
        attacker_count_result = await session.exec(
            select(WarDefensePlacement)
            .join(ChampionUser, WarDefensePlacement.attacker_champion_user_id == ChampionUser.id)
            .where(
                and_(
                    WarDefensePlacement.war_id == war_id,
                    WarDefensePlacement.battlegroup == battlegroup,
                    ChampionUser.game_account_id == game_account.id,
                )
            ).group_by(ChampionUser.id)
        )
        all_attackers = attacker_count_result.all()
        all_attackers_ids = set(a.attacker_champion_user_id for a in all_attackers)
        all_attackers_ids.add(champion_user_id)  # include the new one we're trying to add
        member_attacker_count = len(all_attackers_ids)
        if member_attacker_count > 3:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This member already has 3 attackers assigned in this battlegroup",
            )

        # 8. Assign
        placement_id = placement.id
        placement.attacker_champion_user_id = champion_user_id
        session.add(placement)
        await session.commit()
        session.expire(placement)

        return WarPlacementResponse.model_validate(
            await cls._load_placement(session, placement_id)
        )

    @classmethod
    async def remove_attacker(
        cls,
        session: SessionDep,
        war_id: uuid.UUID,
        battlegroup: int,
        node_number: int,
    ) -> WarPlacementResponse:
        placement = await cls._get_placement_by_node(session, war_id, battlegroup, node_number)
        if placement is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No defender on this node")
        if placement.attacker_champion_user_id is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No attacker assigned to this node")

        placement.attacker_champion_user_id = None
        session.add(placement)
        await session.commit()

        return WarPlacementResponse.model_validate(
            await cls._load_placement(session, placement.id)
        )

    @classmethod
    async def update_ko(
        cls,
        session: SessionDep,
        war_id: uuid.UUID,
        battlegroup: int,
        node_number: int,
        ko_count: int,
    ) -> WarPlacementResponse:
        placement = await cls._get_placement_by_node(session, war_id, battlegroup, node_number)
        if placement is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No defender on this node")

        placement.ko_count = ko_count
        session.add(placement)
        await session.commit()

        return WarPlacementResponse.model_validate(
            await cls._load_placement(session, placement.id)
        )

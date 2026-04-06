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
from src.models.WarBan import WarBan
from src.models.WarDefensePlacement import WarDefensePlacement
from src.models.WarSynergyAttacker import WarSynergyAttacker
from src.models.WarPrefightAttacker import WarPrefightAttacker
from src.dto.dto_war import (
    WarResponse,
    WarPlacementCreateRequest,
    WarPlacementResponse,
    WarDefenseSummaryResponse,
    AvailableAttackerResponse,
    AvailablePrefightAttackerResponse,
    WarSynergyResponse,
    WarPrefightResponse,
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
        banned_champion_ids: list[uuid.UUID] | None = None,
    ) -> WarResponse:
        if banned_champion_ids is None:
            banned_champion_ids = []

        if len(banned_champion_ids) != len(set(banned_champion_ids)):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Banned champion list contains duplicates",
            )

        existing = await session.exec(
            select(War).where(War.alliance_id == alliance_id, War.status == WarStatus.active)
        )
        if existing.first() is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An active war already exists for this alliance",
            )

        for champion_id in banned_champion_ids:
            champ = await session.get(Champion, champion_id)
            if champ is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Champion {champion_id} not found",
                )

        war = War(
            alliance_id=alliance_id,
            opponent_name=opponent_name,
            created_by_id=created_by_id,
        )
        session.add(war)
        await session.flush()

        for champion_id in banned_champion_ids:
            session.add(WarBan(war_id=war.id, champion_id=champion_id))

        await session.commit()
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
            .options(
                selectinload(War.created_by),  # type: ignore[arg-type]
                selectinload(War.bans).selectinload(WarBan.champion),  # type: ignore[arg-type]
            )
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
            .options(
                selectinload(War.created_by),  # type: ignore[arg-type]
                selectinload(War.bans).selectinload(WarBan.champion),  # type: ignore[arg-type]
            )
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
        alliance_id: uuid.UUID,
        battlegroup: int,
        attacker_id: Optional[uuid.UUID] = None,
        war: Optional[War] = None,
    ) -> list[AvailableAttackerResponse]:
        # Get members assigned to this battlegroup (or just the specific attacker)
        member_conditions = and_(
            GameAccount.alliance_id == alliance_id,
            GameAccount.alliance_group == battlegroup,
        )
        if attacker_id is not None:
            member_conditions = and_(GameAccount.id == attacker_id)
        members_result = await session.exec(
            select(GameAccount)
            .where(member_conditions)
            .options(
                selectinload(GameAccount.roster).selectinload(ChampionUser.champion),  # type: ignore[arg-type]
            )
        )
        members = members_result.all()

        # Get champion_user_ids already placed in regular defense for members currently in this BG.
        defense_conditions = and_(
            DefensePlacement.alliance_id == alliance_id,
            GameAccount.alliance_group == battlegroup,
        )
        if attacker_id is not None:
            defense_conditions = and_(DefensePlacement.game_account_id == attacker_id)
        request_sql = select(
            DefensePlacement.champion_user_id).join(
                GameAccount, DefensePlacement.game_account_id == GameAccount.id
            ).where(defense_conditions)
        defense_result = await session.exec(request_sql)
        defense_champion_user_ids = set(defense_result.all())
        banned_champion_ids: set[uuid.UUID] = {ban.champion_id for ban in war.bans} if war else set()
        result: list[AvailableAttackerResponse] = []
        for game_account in members:
            all_attackers_ids: set[uuid.UUID] = set()
            if war:
                node_result = await session.exec(
                    select(WarDefensePlacement)
                    .join(ChampionUser, WarDefensePlacement.attacker_champion_user_id == ChampionUser.id)
                    .where(
                        and_(
                            WarDefensePlacement.war_id == war.id,
                            WarDefensePlacement.battlegroup == battlegroup,
                            ChampionUser.game_account_id == game_account.id,
                        )
                    )
                )
                all_attackers_ids = {p.attacker_champion_user_id for p in node_result.all()}
                synergy_result = await session.exec(
                    select(WarSynergyAttacker).where(
                        and_(
                            WarSynergyAttacker.war_id == war.id,
                            WarSynergyAttacker.battlegroup == battlegroup,
                            WarSynergyAttacker.game_account_id == game_account.id,
                        )
                    )
                )
                synergy_ids = {s.champion_user_id for s in synergy_result.all()}
                all_attackers_ids = all_attackers_ids | synergy_ids
                prefight_result = await session.exec(
                    select(WarPrefightAttacker).where(
                        and_(
                            WarPrefightAttacker.war_id == war.id,
                            WarPrefightAttacker.battlegroup == battlegroup,
                            WarPrefightAttacker.game_account_id == game_account.id,
                        )
                    )
                )
                prefight_ids = {pf.champion_user_id for pf in prefight_result.all()}
                all_attackers_ids = all_attackers_ids | prefight_ids
            for champion_user in game_account.roster:
                if champion_user.id in defense_champion_user_ids:
                    continue
                if champion_user.champion_id in banned_champion_ids:
                    continue
                if war and len(all_attackers_ids) >= 3 and champion_user.id not in all_attackers_ids:
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
    async def get_available_prefight_attackers(
        cls,
        session: SessionDep,
        alliance_id: uuid.UUID,
        battlegroup: int,
        war: War = None,
    ) -> list[AvailablePrefightAttackerResponse]:
        # Exclude champion_users already on defense in this BG
        defense_subq = (
            select(DefensePlacement.champion_user_id)
            .join(GameAccount, DefensePlacement.game_account_id == GameAccount.id)
            .where(and_(
                DefensePlacement.alliance_id == alliance_id,
                GameAccount.alliance_group == battlegroup,
            ))
            .scalar_subquery()
        )

        stmt = (
            select(ChampionUser, GameAccount, Champion)
            .join(GameAccount, ChampionUser.game_account_id == GameAccount.id)  # type: ignore[arg-type]
            .join(Champion, ChampionUser.champion_id == Champion.id)  # type: ignore[arg-type]
            .where(
                GameAccount.alliance_id == alliance_id,
                GameAccount.alliance_group == battlegroup,
                Champion.has_prefight == True,  # noqa: E712
                ChampionUser.id.not_in(defense_subq),  # type: ignore[union-attr]
            )
        )
        banned_champion_ids: list[uuid.UUID] = [ban.champion_id for ban in war.bans] if war else []
        if banned_champion_ids:
            stmt = stmt.where(ChampionUser.champion_id.not_in(banned_champion_ids))  # type: ignore[union-attr]

        rows = (await session.exec(stmt)).all()  # type: ignore[arg-type]
        return [
            AvailablePrefightAttackerResponse(
                champion_user_id=cu.id,
                game_account_id=ga.id,
                game_pseudo=ga.game_pseudo,
                champion_id=cu.champion_id,
                champion_name=champ.name,
                champion_class=champ.champion_class,
                image_url=champ.image_url,
                rarity=cu.rarity,
            )
            for cu, ga, champ in rows
        ]

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

        # 4. Check champion is not banned in this war
        ban_check = await session.exec(
            select(WarBan).where(
                and_(WarBan.war_id == war_id, WarBan.champion_id == champion_user.champion_id)
            )
        )
        if ban_check.first():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This champion is banned for this war",
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

        # 5. Check member has fewer than 3 attackers in this war+BG (union of node attackers + synergy).
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
            )
        )
        all_attackers = attacker_count_result.all()
        all_attackers_ids = set(a.attacker_champion_user_id for a in all_attackers if a.node_number != node_number)  # exclude the current node since we're replacing any existing attacker there
        all_attackers_ids.add(champion_user_id)  # include the new one we're trying to add
        # Union with synergy attackers (couteau suisse deduplicates automatically)
        synergy_result = await session.exec(
            select(WarSynergyAttacker).where(
                and_(
                    WarSynergyAttacker.war_id == war_id,
                    WarSynergyAttacker.battlegroup == battlegroup,
                    WarSynergyAttacker.game_account_id == game_account.id,
                )
            )
        )
        synergy_ids = {s.champion_user_id for s in synergy_result.all()}
        prefight_result = await session.exec(
            select(WarPrefightAttacker).where(
                and_(
                    WarPrefightAttacker.war_id == war_id,
                    WarPrefightAttacker.battlegroup == battlegroup,
                    WarPrefightAttacker.game_account_id == game_account.id,
                )
            )
        )
        prefight_ids = {pf.champion_user_id for pf in prefight_result.all()}
        all_attackers_ids = all_attackers_ids | synergy_ids | prefight_ids
        member_attacker_count = len(all_attackers_ids)
        if member_attacker_count > 3:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This member already has 3 attackers assigned in this battlegroup",
            )

        # 6. Assign
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

        removed_champion_user_id = placement.attacker_champion_user_id
        placement.attacker_champion_user_id = None
        placement.ko_count = 0
        session.add(placement)
        await session.commit()

        # If this was the attacker's last node in this war+BG, remove their synergy entry
        remaining = await session.exec(
            select(WarDefensePlacement).where(
                and_(
                    WarDefensePlacement.war_id == war_id,
                    WarDefensePlacement.battlegroup == battlegroup,
                    WarDefensePlacement.attacker_champion_user_id == removed_champion_user_id,
                )
            )
        )
        if not remaining.first():
            synergy_result = await session.exec(
                select(WarSynergyAttacker).where(
                    and_(
                        WarSynergyAttacker.war_id == war_id,
                        WarSynergyAttacker.battlegroup == battlegroup,
                        WarSynergyAttacker.champion_user_id == removed_champion_user_id,
                    )
                )
            )
            synergy = synergy_result.first()
            if synergy:
                await session.delete(synergy)
                await session.commit()

            # Clean up synergy entries where the removed attacker was the target
            target_synergy_result = await session.exec(
                select(WarSynergyAttacker).where(
                    and_(
                        WarSynergyAttacker.war_id == war_id,
                        WarSynergyAttacker.battlegroup == battlegroup,
                        WarSynergyAttacker.target_champion_user_id == removed_champion_user_id,
                    )
                )
            )
            target_synergies = target_synergy_result.all()
            for ts in target_synergies:
                await session.delete(ts)
            if target_synergies:
                await session.commit()

        # Clean up prefight entries targeting this node
        prefight_cleanup_result = await session.exec(
            select(WarPrefightAttacker).where(
                and_(
                    WarPrefightAttacker.war_id == war_id,
                    WarPrefightAttacker.battlegroup == battlegroup,
                    WarPrefightAttacker.target_node_number == node_number,
                )
            )
        )
        prefights_to_delete = prefight_cleanup_result.all()
        for pf in prefights_to_delete:
            await session.delete(pf)
        if prefights_to_delete:
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

        if placement.attacker_champion_user_id is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot update KO count: no attacker assigned to this node")

        placement.ko_count = ko_count
        session.add(placement)
        await session.commit()

        return WarPlacementResponse.model_validate(
            await cls._load_placement(session, placement.id)
        )

    # ─── Synergy endpoints ────────────────────────────────────────────────────

    @classmethod
    async def _load_synergy(cls, session: SessionDep, synergy_id: uuid.UUID) -> WarSynergyAttacker:
        stmt = (
            select(WarSynergyAttacker)
            .where(WarSynergyAttacker.id == synergy_id)
            .options(
                selectinload(WarSynergyAttacker.game_account),  # type: ignore[arg-type]
                selectinload(WarSynergyAttacker.champion_user).selectinload(ChampionUser.champion),  # type: ignore[arg-type]
                selectinload(WarSynergyAttacker.target_champion_user).selectinload(ChampionUser.champion),  # type: ignore[arg-type]
            )
        )
        result = await session.exec(stmt)
        return result.one()

    @classmethod
    async def get_synergy_attackers(
        cls,
        session: SessionDep,
        war_id: uuid.UUID,
        battlegroup: int,
    ) -> list[WarSynergyResponse]:
        stmt = (
            select(WarSynergyAttacker)
            .where(
                and_(
                    WarSynergyAttacker.war_id == war_id,
                    WarSynergyAttacker.battlegroup == battlegroup,
                )
            )
            .options(
                selectinload(WarSynergyAttacker.game_account),  # type: ignore[arg-type]
                selectinload(WarSynergyAttacker.champion_user).selectinload(ChampionUser.champion),  # type: ignore[arg-type]
                selectinload(WarSynergyAttacker.target_champion_user).selectinload(ChampionUser.champion),  # type: ignore[arg-type]
            )
        )
        result = await session.exec(stmt)
        return [WarSynergyResponse.model_validate(s) for s in result.all()]

    @classmethod
    async def add_synergy_attacker(
        cls,
        session: SessionDep,
        war_id: uuid.UUID,
        alliance_id: uuid.UUID,
        battlegroup: int,
        champion_user_id: uuid.UUID,
        target_champion_user_id: uuid.UUID,
        current_user_id: uuid.UUID,
    ) -> WarSynergyResponse:
        # 1. Load champion_user and validate it belongs to this alliance + BG
        cu_stmt = (
            select(ChampionUser)
            .where(ChampionUser.id == champion_user_id)
            .options(selectinload(ChampionUser.game_account))  # type: ignore[arg-type]
        )
        champion_user = (await session.exec(cu_stmt)).first()
        if champion_user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Champion user not found")
        tcu_stmt = (
            select(ChampionUser)
            .where(ChampionUser.id == target_champion_user_id)
            .options(selectinload(ChampionUser.game_account))  # type: ignore[arg-type]
        )
        target_champion_user = (await session.exec(tcu_stmt)).first()
        if target_champion_user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target champion user not found")

        game_account = champion_user.game_account
        if game_account.user_id != target_champion_user.game_account.user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only add your own champions as synergy providers",
            )
        if game_account.alliance_id != alliance_id or game_account.alliance_group != battlegroup:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This champion does not belong to a member of this alliance battlegroup",
            )

        # 2. target_champion_user_id must be assigned as a node attacker in this war+BG
        target_check = await session.exec(
            select(WarDefensePlacement).where(
                and_(
                    WarDefensePlacement.war_id == war_id,
                    WarDefensePlacement.battlegroup == battlegroup,
                    WarDefensePlacement.attacker_champion_user_id == target_champion_user_id,
                )
            )
        )
        if target_check.first() is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Target champion is not assigned as a node attacker in this war+BG",
            )

        # 2b. Synergy provider must belong to the same game account as the target attacker
        target_cu = (await session.exec(
            select(ChampionUser).where(ChampionUser.id == target_champion_user_id)
        )).first()
        if target_cu is None or target_cu.game_account_id != game_account.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Synergy provider must belong to the same game account as the target attacker",
            )

        # 3. Check synergy provider's champion is not banned in this war
        synergy_ban_check = await session.exec(
            select(WarBan).where(
                and_(WarBan.war_id == war_id, WarBan.champion_id == champion_user.champion_id)
            )
        )
        if synergy_ban_check.first():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This champion is banned for this war",
            )

        # 3b. champion_user_id not already in regular alliance defense for this BG
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

        # 4. 3-slot limit: union of node attackers + synergy attackers
        node_result = await session.exec(
            select(WarDefensePlacement)
            .join(ChampionUser, WarDefensePlacement.attacker_champion_user_id == ChampionUser.id)
            .where(
                and_(
                    WarDefensePlacement.war_id == war_id,
                    WarDefensePlacement.battlegroup == battlegroup,
                    ChampionUser.game_account_id == game_account.id,
                )
            )
        )
        node_ids = {p.attacker_champion_user_id for p in node_result.all()}

        synergy_result = await session.exec(
            select(WarSynergyAttacker).where(
                and_(
                    WarSynergyAttacker.war_id == war_id,
                    WarSynergyAttacker.battlegroup == battlegroup,
                    WarSynergyAttacker.game_account_id == game_account.id,
                )
            )
        )
        synergy_ids = {s.champion_user_id for s in synergy_result.all()}

        prefight_result = await session.exec(
            select(WarPrefightAttacker).where(
                and_(
                    WarPrefightAttacker.war_id == war_id,
                    WarPrefightAttacker.battlegroup == battlegroup,
                    WarPrefightAttacker.game_account_id == game_account.id,
                )
            )
        )
        prefight_ids = {pf.champion_user_id for pf in prefight_result.all()}

        total_slots = len(node_ids | synergy_ids | prefight_ids | {champion_user_id})
        if total_slots > 3:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This member already has 3 attackers assigned in this battlegroup",
            )

        # 5. Insert (unique constraint handles duplicate)
        synergy = WarSynergyAttacker(
            war_id=war_id,
            battlegroup=battlegroup,
            game_account_id=game_account.id,
            champion_user_id=champion_user_id,
            target_champion_user_id=target_champion_user_id,
        )
        session.add(synergy)
        try:
            await session.commit()
        except Exception:
            await session.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This champion is already a synergy provider in this war+BG",
            )

        return WarSynergyResponse.model_validate(
            await cls._load_synergy(session, synergy.id)
        )

    @classmethod
    async def remove_synergy_attacker(
        cls,
        session: SessionDep,
        war_id: uuid.UUID,
        battlegroup: int,
        champion_user_id: uuid.UUID,
    ) -> None:
        result = await session.exec(
            select(WarSynergyAttacker).where(
                and_(
                    WarSynergyAttacker.war_id == war_id,
                    WarSynergyAttacker.battlegroup == battlegroup,
                    WarSynergyAttacker.champion_user_id == champion_user_id,
                )
            )
        )
        synergy = result.first()
        if synergy is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Synergy attacker not found")
        await session.delete(synergy)
        await session.commit()

    # ─── Prefight endpoints ───────────────────────────────────────────────────

    @classmethod
    async def _load_prefight(cls, session: SessionDep, prefight_id: uuid.UUID) -> WarPrefightAttacker:
        stmt = (
            select(WarPrefightAttacker)
            .where(WarPrefightAttacker.id == prefight_id)
            .options(
                selectinload(WarPrefightAttacker.game_account),  # type: ignore[arg-type]
                selectinload(WarPrefightAttacker.champion_user).selectinload(ChampionUser.champion),  # type: ignore[arg-type]
            )
        )
        return (await session.exec(stmt)).one()

    @classmethod
    async def get_prefight_attackers(
        cls,
        session: SessionDep,
        war_id: uuid.UUID,
        battlegroup: int,
    ) -> list[WarPrefightResponse]:
        stmt = (
            select(WarPrefightAttacker)
            .where(
                and_(
                    WarPrefightAttacker.war_id == war_id,
                    WarPrefightAttacker.battlegroup == battlegroup,
                )
            )
            .options(
                selectinload(WarPrefightAttacker.game_account),  # type: ignore[arg-type]
                selectinload(WarPrefightAttacker.champion_user).selectinload(ChampionUser.champion),  # type: ignore[arg-type]
            )
        )
        result = await session.exec(stmt)
        return [WarPrefightResponse.model_validate(p) for p in result.all()]

    @classmethod
    async def add_prefight_attacker(
        cls,
        session: SessionDep,
        war_id: uuid.UUID,
        alliance_id: uuid.UUID,
        battlegroup: int,
        champion_user_id: uuid.UUID,
        target_node_number: int,
    ) -> WarPrefightResponse:
        # 1. Load champion_user with game_account
        champion_user_stmt = (
            select(ChampionUser)
            .where(ChampionUser.id == champion_user_id)
            .options(
                selectinload(ChampionUser.game_account),  # type: ignore[arg-type]
                selectinload(ChampionUser.champion),  # type: ignore[arg-type]
            )
        )
        champion_user = (await session.exec(champion_user_stmt)).first()
        if champion_user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Champion user not found")

        # 1c. Champion must have has_prefight capability
        if not champion_user.champion.has_prefight:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="This champion does not have a pre-fight ability",
            )

        game_account = champion_user.game_account
        # 1b. Provider must belong to this alliance + BG (any BG member's champion is valid)
        if game_account.alliance_id != alliance_id or game_account.alliance_group != battlegroup:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This champion does not belong to a member of this alliance battlegroup",
            )

        # 2. Target node must have a defender placed in this war+BG
        target_placement = await cls._get_placement_by_node(session, war_id, battlegroup, target_node_number)
        if target_placement is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Target node has no defender placed in this war+BG",
            )

        # 2b. Target node must have an attacker assigned
        if target_placement.attacker_champion_user_id is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Target node has no attacker assigned",
            )

        # 3. Provider champion not banned in this war
        ban_check = await session.exec(
            select(WarBan).where(
                and_(WarBan.war_id == war_id, WarBan.champion_id == champion_user.champion_id)
            )
        )
        if ban_check.first():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This champion is banned for this war",
            )

        # 3b. Provider not in regular alliance defense for this BG
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

        # 4. 3-slot limit: union of node attackers + synergy + pre-fight for this game account
        node_result = await session.exec(
            select(WarDefensePlacement)
            .join(ChampionUser, WarDefensePlacement.attacker_champion_user_id == ChampionUser.id)
            .where(
                and_(
                    WarDefensePlacement.war_id == war_id,
                    WarDefensePlacement.battlegroup == battlegroup,
                    ChampionUser.game_account_id == game_account.id,
                )
            )
        )
        node_ids = {p.attacker_champion_user_id for p in node_result.all()}

        synergy_result = await session.exec(
            select(WarSynergyAttacker).where(
                and_(
                    WarSynergyAttacker.war_id == war_id,
                    WarSynergyAttacker.battlegroup == battlegroup,
                    WarSynergyAttacker.game_account_id == game_account.id,
                )
            )
        )
        synergy_ids = {s.champion_user_id for s in synergy_result.all()}

        prefight_result = await session.exec(
            select(WarPrefightAttacker).where(
                and_(
                    WarPrefightAttacker.war_id == war_id,
                    WarPrefightAttacker.battlegroup == battlegroup,
                    WarPrefightAttacker.game_account_id == game_account.id,
                )
            )
        )
        prefight_ids = {pf.champion_user_id for pf in prefight_result.all()}

        total_slots = len(node_ids | synergy_ids | prefight_ids | {champion_user_id})
        if total_slots > 3:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This member already has 3 attackers assigned in this battlegroup",
            )

        # 5. Insert (unique constraint handles duplicate)
        prefight = WarPrefightAttacker(
            war_id=war_id,
            battlegroup=battlegroup,
            game_account_id=game_account.id,
            champion_user_id=champion_user_id,
            target_node_number=target_node_number,
        )
        session.add(prefight)
        try:
            await session.commit()
        except Exception:
            await session.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This champion is already assigned as pre-fight on this node",
            )

        return WarPrefightResponse.model_validate(
            await cls._load_prefight(session, prefight.id)
        )

    @classmethod
    async def remove_prefight_attacker(
        cls,
        session: SessionDep,
        war_id: uuid.UUID,
        battlegroup: int,
        champion_user_id: uuid.UUID,
    ) -> None:
        result = await session.exec(
            select(WarPrefightAttacker).where(
                and_(
                    WarPrefightAttacker.war_id == war_id,
                    WarPrefightAttacker.battlegroup == battlegroup,
                    WarPrefightAttacker.champion_user_id == champion_user_id,
                )
            )
        )
        prefight = result.first()
        if prefight is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pre-fight entry not found")
        await session.delete(prefight)
        await session.commit()

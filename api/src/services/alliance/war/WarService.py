import uuid
from collections import defaultdict
from collections.abc import Sequence

from fastapi import HTTPException
from sqlalchemy import Integer, case, cast, func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload
from sqlmodel import col, select
from starlette import status

from src.dto.alliance.war.dto_war import (
    MAX_BANNED_CHAMPIONS,
    AvailableAttackerResponse,
    AvailablePrefightAttackerResponse,
    WarBgProgressResponse,
    WarBoostUpdateRequest,
    WarDefenseSummaryResponse,
    WarPlacementCreateRequest,
    WarPlacementResponse,
    WarPrefightResponse,
    WarProgressResponse,
    WarResponse,
    WarSynergyResponse,
)
from src.enums.SeasonFormat import SeasonFormat
from src.enums.UnrecordedReason import UnrecordedReason
from src.enums.WarStatus import WarStatus
from src.game_types import KoCount
from src.Messages.game_account_messages import GAME_ACCOUNT_NOT_FOUND
from src.Messages.war_messages import (
    ACTIVE_WAR_ALREADY_EXISTS,
    ASSIST_NO_ATTACKER_ASSIGNED,
    ASSIST_NOT_FOUND,
    ASSIST_SAME_ACCOUNT,
    BANNED_CHAMPION_LIST_DUPLICATES,
    BANNED_CHAMPION_LIST_TOO_LONG,
    BOOSTS_NO_ATTACKER_ASSIGNED,
    CHAMPION_ALREADY_IN_ALLIANCE_DEFENSE,
    CHAMPION_ALREADY_PREFIGHT_ON_NODE,
    CHAMPION_ALREADY_SYNERGY_PROVIDER,
    CHAMPION_BANNED_FOR_WAR,
    CHAMPION_HAS_RECORDED_COPY,
    CHAMPION_NO_PREFIGHT_ABILITY,
    CHAMPION_NOT_FOUND,
    CHAMPION_NOT_IN_ALLIANCE_BG,
    CHAMPION_USER_NOT_FOUND,
    COMBAT_COMPLETED_LOCKED,
    FIGHT_NOT_DONE_CONFLICT,
    KO_COUNT_NO_ATTACKER_ASSIGNED,
    NO_ACTIVE_WAR_FOR_ALLIANCE,
    NO_ATTACKER_ASSIGNED_FOR_FLAG,
    NO_ATTACKER_ASSIGNED_ON_NODE,
    NO_DEFENDER_ON_NODE,
    NODE_HAS_NO_DEFENDER_PLACE_FIRST,
    ONLY_OWN_CHAMPIONS_SYNERGY,
    PLANNING_ERROR_CONFLICT,
    PREFIGHT_ENTRY_NOT_FOUND,
    SYNERGY_ATTACKER_NOT_FOUND,
    SYNERGY_PROVIDER_CANNOT_BE_TARGET,
    TARGET_CHAMPION_USER_NOT_FOUND,
    TARGET_NODE_NO_ATTACKER_ASSIGNED,
    TARGET_NODE_NO_DEFENDER_IN_WAR_BG,
    TARGET_NOT_ASSIGNED_AS_NODE_ATTACKER,
    WAR_NOT_FOUND,
    champion_with_id_not_found,
    ko_count_exceeds_format,
    member_max_attackers_reached,
    node_exceeds_map,
)
from src.models.alliance.Alliance import Alliance
from src.models.alliance.DefensePlan import DefensePlanNode
from src.models.champion.Champion import Champion
from src.models.champion.ChampionUser import ChampionUser
from src.models.user.GameAccount import GameAccount
from src.models.war.Season import Season
from src.models.war.War import War
from src.models.war.WarBan import WarBan
from src.models.war.WarDefensePlacement import WarDefensePlacement
from src.models.war.WarFightNote import WarFightNote
from src.models.war.WarPrefightAttacker import WarPrefightAttacker
from src.models.war.WarReadyBattlegroup import WarReadyBattlegroup
from src.models.war.WarSynergyAttacker import WarSynergyAttacker
from src.services.admin.ModerationService import AUTO_BLOCK_THRESHOLD, ModerationService
from src.services.admin.SagaService import SagaService
from src.services.admin.SeasonService import SeasonService
from src.services.alliance.defense.DefensePlanService import DefensePlanService
from src.services.alliance.war.ClosedWarPolicy import ClosedWarPolicy
from src.services.alliance.war.WarFormatConfig import for_format
from src.services.knowledge.FightRecordService import FightRecordService
from src.services.SeasonService import SeasonService as DisplaySeasonService
from src.utils.db import SessionDep

BATTLEGROUPS = (1, 2, 3)
NO_SAGA = (False, False)

_WAR_OPTIONS = (
    selectinload(War.created_by),  # type: ignore[arg-type]
    selectinload(War.bans).selectinload(WarBan.champion),  # type: ignore[arg-type]
    selectinload(War.season),  # type: ignore[arg-type]
)
_PLACEMENT_OPTIONS = (
    selectinload(WarDefensePlacement.champion),  # type: ignore[arg-type]
    selectinload(WarDefensePlacement.placed_by),  # type: ignore[arg-type]
    selectinload(WarDefensePlacement.attacker_champion_user).selectinload(ChampionUser.champion),  # type: ignore[arg-type]
    selectinload(WarDefensePlacement.attacker_champion_user).selectinload(
        ChampionUser.game_account
    ),  # type: ignore[arg-type]
    selectinload(WarDefensePlacement.assist_champion_user).selectinload(ChampionUser.champion),  # type: ignore[arg-type]
    selectinload(WarDefensePlacement.assist_champion_user).selectinload(ChampionUser.game_account),  # type: ignore[arg-type]
)
_SYNERGY_OPTIONS = (
    selectinload(WarSynergyAttacker.game_account),  # type: ignore[arg-type]
    selectinload(WarSynergyAttacker.champion),  # type: ignore[arg-type]
    selectinload(WarSynergyAttacker.champion_user),  # type: ignore[arg-type]
    selectinload(WarSynergyAttacker.target_champion_user).selectinload(ChampionUser.champion),  # type: ignore[arg-type]
)
_PREFIGHT_OPTIONS = (
    selectinload(WarPrefightAttacker.game_account),  # type: ignore[arg-type]
    selectinload(WarPrefightAttacker.champion),  # type: ignore[arg-type]
    selectinload(WarPrefightAttacker.champion_user),  # type: ignore[arg-type]
)


def _copy_strength(cu: ChampionUser) -> tuple[int, int, int]:
    return (cu.stars, cu.rank, cu.ascension)


class WarService:
    # ─── War ──────────────────────────────────────────────────────────────────

    @staticmethod
    async def _check_bans(session: SessionDep, banned_champion_ids: list[uuid.UUID]) -> None:
        if len(banned_champion_ids) > MAX_BANNED_CHAMPIONS:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT, BANNED_CHAMPION_LIST_TOO_LONG
            )
        if len(banned_champion_ids) != len(set(banned_champion_ids)):
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT, BANNED_CHAMPION_LIST_DUPLICATES
            )
        for champion_id in banned_champion_ids:
            if await session.get(Champion, champion_id) is None:
                raise HTTPException(
                    status.HTTP_404_NOT_FOUND, champion_with_id_not_found(champion_id)
                )

    @classmethod
    async def create_war(
        cls,
        session: SessionDep,
        alliance_id: uuid.UUID,
        opponent_name: str,
        created_by_id: uuid.UUID,
        banned_champion_ids: list[uuid.UUID],
    ) -> WarResponse:
        await cls._check_bans(session, banned_champion_ids)
        existing = await session.exec(
            select(War).where(War.alliance_id == alliance_id, War.status == WarStatus.ACTIVE)
        )
        if existing.first() is not None:
            raise HTTPException(status.HTTP_409_CONFLICT, ACTIVE_WAR_ALREADY_EXISTS)

        active_season = await SeasonService.get_active_season(session)
        war = War(
            alliance_id=alliance_id,
            opponent_name=opponent_name,
            created_by_id=created_by_id,
            season_id=active_season.id if active_season else None,
        )
        session.add(war)
        await session.flush()
        session.add_all(WarBan(war_id=war.id, champion_id=c) for c in banned_champion_ids)
        await session.commit()
        return await cls._war_response(session, war.id)

    @classmethod
    async def update_war(
        cls,
        session: SessionDep,
        war_id: uuid.UUID,
        alliance_id: uuid.UUID,
        opponent_name: str,
        banned_champion_ids: list[uuid.UUID],
    ) -> WarResponse:
        war = await cls.get_war(session, war_id, alliance_id)
        ClosedWarPolicy.assert_open(war)
        await cls._check_bans(session, banned_champion_ids)

        war.opponent_name = opponent_name
        for ban in (await session.exec(select(WarBan).where(WarBan.war_id == war_id))).all():
            await session.delete(ban)
        await session.flush()
        session.add_all(WarBan(war_id=war_id, champion_id=c) for c in banned_champion_ids)
        await session.commit()
        session.expire(war, ["bans"])
        return await cls._war_response(session, war_id)

    @classmethod
    async def get_wars(cls, session: SessionDep, alliance_id: uuid.UUID) -> list[WarResponse]:
        wars = (
            await session.exec(
                select(War)
                .where(War.alliance_id == alliance_id)
                .options(*_WAR_OPTIONS)
                .order_by(col(War.created_at).desc())
            )
        ).all()
        latest_season = await DisplaySeasonService.get_display_season(session)
        current_format = await SeasonService.get_current_format(session)
        return [
            await cls._war_dto(
                session, w, latest_season=latest_season, current_format=current_format
            )
            for w in wars
        ]

    @classmethod
    async def get_current_war(cls, session: SessionDep, alliance_id: uuid.UUID) -> WarResponse:
        war = (
            await session.exec(
                select(War).where(War.alliance_id == alliance_id, War.status == WarStatus.ACTIVE)
            )
        ).first()
        if war is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, NO_ACTIVE_WAR_FOR_ALLIANCE)
        return await cls._war_response(session, war.id)

    @classmethod
    async def get_war(cls, session: SessionDep, war_id: uuid.UUID, alliance_id: uuid.UUID) -> War:
        war = await cls._find_war(session, war_id)
        if war is None or war.alliance_id != alliance_id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, WAR_NOT_FOUND)
        return war

    @staticmethod
    async def _find_war(session: SessionDep, war_id: uuid.UUID) -> War | None:
        return (
            await session.exec(select(War).where(War.id == war_id).options(*_WAR_OPTIONS))
        ).first()

    @classmethod
    async def _load_war(cls, session: SessionDep, war_id: uuid.UUID) -> War:
        war = await cls._find_war(session, war_id)
        if war is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, WAR_NOT_FOUND)
        return war

    @staticmethod
    async def _war_format(
        session: SessionDep, war: War | None, current_format: SeasonFormat | None = None
    ) -> SeasonFormat:
        """A closed War keeps its Season's format; a running one follows the Season being played or prepared."""
        if war is not None and war.status == WarStatus.ENDED and war.season is not None:
            return war.season.format
        return current_format or await SeasonService.get_current_format(session)

    @classmethod
    async def _war_dto(
        cls,
        session: SessionDep,
        war: War,
        *,
        latest_season: Season | None = None,
        current_format: SeasonFormat | None = None,
    ) -> WarResponse:
        if latest_season is None:
            latest_season = await DisplaySeasonService.get_display_season(session)
        war_format = await cls._war_format(session, war, current_format)
        params = for_format(war_format)
        return WarResponse.model_validate(war).model_copy(
            update={
                "is_map_correctable": ClosedWarPolicy.is_map_correctable(war, latest_season),
                "format": war_format,
                "node_count": params.node_count,
                "max_attackers_per_member": params.max_attackers_per_member,
                "max_ko_count": params.max_ko_count,
            }
        )

    @classmethod
    async def _war_response(cls, session: SessionDep, war_id: uuid.UUID) -> WarResponse:
        return await cls._war_dto(session, await cls._load_war(session, war_id))

    @classmethod
    async def set_opponent_deaths(
        cls,
        session: SessionDep,
        war_id: uuid.UUID,
        alliance_id: uuid.UUID,
        opponent_deaths: int | None,
    ) -> WarResponse:
        """Correct the manually entered enemy deaths, on an ended war too.

        Nothing tracks this figure yet, so an officer has to be able to backfill
        wars that ended before the field existed.
        """
        war = await cls.get_war(session, war_id, alliance_id)
        war.opponent_deaths = opponent_deaths
        await session.commit()
        return await cls._war_response(session, war.id)

    @classmethod
    async def end_war(
        cls,
        session: SessionDep,
        war_id: uuid.UUID,
        alliance_id: uuid.UUID,
        win: bool,
        elo_change: int | None,
        opponent_deaths: int | None = None,
    ) -> WarResponse:
        war = await cls.get_war(session, war_id, alliance_id)
        ClosedWarPolicy.assert_open(war)
        alliance = await session.get_one(Alliance, alliance_id)

        if war.season_id is not None:
            if elo_change is None:
                raise HTTPException(
                    status.HTTP_422_UNPROCESSABLE_CONTENT,
                    "elo_change is required during an active season",
                )
            if win and elo_change < 0:
                raise HTTPException(
                    status.HTTP_422_UNPROCESSABLE_CONTENT, "elo_change must be positive on a win"
                )
            if not win and elo_change > 0:
                raise HTTPException(
                    status.HTTP_422_UNPROCESSABLE_CONTENT, "elo_change must be negative on a loss"
                )
            war.elo_change = elo_change
            alliance.elo = max(0, min(4500, alliance.elo + elo_change))

        war.status = WarStatus.ENDED
        war.win = win
        war.opponent_deaths = opponent_deaths
        war.tier = alliance.tier
        await session.commit()
        await session.refresh(war)

        await FightRecordService.snapshot_war(session, war)
        return await cls._war_response(session, war.id)

    # ─── Defense ──────────────────────────────────────────────────────────────

    @classmethod
    async def get_war_defense(
        cls, session: SessionDep, war_id: uuid.UUID, battlegroup: int
    ) -> WarDefenseSummaryResponse:
        placements = (
            await session.exec(
                select(WarDefensePlacement)
                .where(
                    WarDefensePlacement.war_id == war_id,
                    WarDefensePlacement.battlegroup == battlegroup,
                )
                .options(*_PLACEMENT_OPTIONS)
            )
        ).all()
        notes = (
            await session.exec(
                select(WarFightNote).where(
                    WarFightNote.war_id == war_id,
                    WarFightNote.battlegroup == battlegroup,
                    col(WarFightNote.deleted_at).is_(None),
                )
            )
        ).all()
        note_by_node = {n.node_number: n for n in notes}
        counts = await ModerationService.pending_report_counts(session, [n.id for n in notes])
        for p in placements:
            note = note_by_node.get(p.node_number)
            blocked = note is not None and counts.get(note.id, 0) >= AUTO_BLOCK_THRESHOLD
            p._note_blocked = blocked
            p._note_id = note.id if note else None
            p._note_content = None if blocked or note is None else note.content
        return WarDefenseSummaryResponse(
            war_id=war_id,
            battlegroup=battlegroup,
            placements=await cls._placement_dtos(session, placements),
            progress=await cls._war_progress(session, war_id),
            is_ready=await cls.ready_row(session, war_id, battlegroup) is not None,
        )

    @staticmethod
    async def ready_row(
        session: SessionDep, war_id: uuid.UUID, battlegroup: int
    ) -> WarReadyBattlegroup | None:
        return (
            await session.exec(
                select(WarReadyBattlegroup).where(
                    WarReadyBattlegroup.war_id == war_id,
                    WarReadyBattlegroup.battlegroup == battlegroup,
                )
            )
        ).first()

    @classmethod
    async def set_bg_ready(
        cls, session: SessionDep, war: War, battlegroup: int, ready: bool
    ) -> bool:
        ClosedWarPolicy.assert_open(war)
        row = await cls.ready_row(session, war.id, battlegroup)
        if ready and row is None:
            session.add(WarReadyBattlegroup(war_id=war.id, battlegroup=battlegroup))
        elif not ready and row is not None:
            await session.delete(row)
        await session.commit()
        return ready

    @classmethod
    async def _war_progress(cls, session: SessionDep, war_id: uuid.UUID) -> WarProgressResponse:
        """Aggregate handled fights and KOs for every battlegroup of the war, in one grouped query."""
        war = await cls._load_war(session, war_id)
        node_count = for_format(await cls._war_format(session, war)).node_count
        handled = cast(
            case(
                (
                    or_(
                        col(WarDefensePlacement.is_combat_completed),
                        col(WarDefensePlacement.is_fight_not_done),
                    ),
                    1,
                ),
                else_=0,
            ),
            Integer,
        )
        rows = (
            await session.exec(
                select(
                    col(WarDefensePlacement.battlegroup),
                    func.coalesce(func.sum(handled), 0),
                    func.coalesce(func.sum(col(WarDefensePlacement.ko_count)), 0),
                )
                .where(col(WarDefensePlacement.war_id) == war_id)
                .group_by(col(WarDefensePlacement.battlegroup))
            )
        ).all()
        totals = {int(bg): (int(completed), int(ko)) for bg, completed, ko in rows}
        battlegroups = [
            WarBgProgressResponse(
                battlegroup=bg,
                completed=totals.get(bg, (0, 0))[0],
                total=node_count,
                ko_count=totals.get(bg, (0, 0))[1],
            )
            for bg in BATTLEGROUPS
        ]
        return WarProgressResponse(
            completed=sum(bg.completed for bg in battlegroups),
            total=node_count * len(BATTLEGROUPS),
            ko_count=sum(bg.ko_count for bg in battlegroups),
            battlegroups=battlegroups,
        )

    @staticmethod
    async def _load_placement(session: SessionDep, placement_id: uuid.UUID) -> WarDefensePlacement:
        return (
            await session.exec(
                select(WarDefensePlacement)
                .where(WarDefensePlacement.id == placement_id)
                .options(*_PLACEMENT_OPTIONS)
            )
        ).one()

    @staticmethod
    def _placement_to_dto(
        placement: WarDefensePlacement,
        saga: dict[uuid.UUID, tuple[bool, bool]],
        war: War,
    ) -> WarPlacementResponse:
        dto = WarPlacementResponse.model_validate(placement)
        dto.is_saga_attacker, dto.is_saga_defender = saga.get(placement.champion_id, NO_SAGA)
        attacker = placement.attacker_champion_user
        if attacker is not None:
            dto.attacker_is_saga_attacker, dto.attacker_is_saga_defender = saga.get(
                attacker.champion_id, NO_SAGA
            )
        dto.is_attacker_locked = ClosedWarPolicy.is_attacker_locked(war, placement)
        return dto

    @classmethod
    async def _placement_dtos(
        cls, session: SessionDep, placements: Sequence[WarDefensePlacement]
    ) -> list[WarPlacementResponse]:
        if not placements:
            return []
        saga = await SagaService.resolve_current(session)
        war = await session.get_one(War, placements[0].war_id)
        return [cls._placement_to_dto(p, saga, war) for p in placements]

    @classmethod
    async def _placement_response(
        cls, session: SessionDep, placement_id: uuid.UUID
    ) -> WarPlacementResponse:
        placement = await cls._load_placement(session, placement_id)
        return (await cls._placement_dtos(session, [placement]))[0]

    @staticmethod
    async def _get_placement_by_node(
        session: SessionDep, war_id: uuid.UUID, battlegroup: int, node_number: int
    ) -> WarDefensePlacement | None:
        return (
            await session.exec(
                select(WarDefensePlacement).where(
                    WarDefensePlacement.war_id == war_id,
                    WarDefensePlacement.battlegroup == battlegroup,
                    WarDefensePlacement.node_number == node_number,
                )
            )
        ).first()

    @classmethod
    async def _require_placement(
        cls, session: SessionDep, war_id: uuid.UUID, battlegroup: int, node_number: int
    ) -> WarDefensePlacement:
        placement = await cls._get_placement_by_node(session, war_id, battlegroup, node_number)
        if placement is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, NO_DEFENDER_ON_NODE)
        return placement

    @classmethod
    async def _assert_attacker_unlocked(
        cls, session: SessionDep, placement: WarDefensePlacement
    ) -> None:
        ClosedWarPolicy.assert_attacker_unlocked(
            await session.get_one(War, placement.war_id),
            await cls._load_placement(session, placement.id),
        )

    @staticmethod
    def _assert_not_completed(placement: WarDefensePlacement) -> None:
        if placement.is_combat_completed:
            raise HTTPException(status.HTTP_409_CONFLICT, COMBAT_COMPLETED_LOCKED)

    @classmethod
    async def place_defender(
        cls,
        session: SessionDep,
        war_id: uuid.UUID,
        battlegroup: int,
        placement_request: WarPlacementCreateRequest,
        placed_by_id: uuid.UUID,
    ) -> WarPlacementResponse:
        if await session.get(Champion, placement_request.champion_id) is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, CHAMPION_NOT_FOUND)

        old_placement = await cls._get_placement_by_node(
            session, war_id, battlegroup, placement_request.node_number
        )
        old_attacker_id = None
        if old_placement:
            await cls._assert_attacker_unlocked(session, old_placement)
            old_attacker_id = old_placement.attacker_champion_user_id
            await FightRecordService.drop_node_record(session, old_placement.id)
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
        if old_placement:
            await cls._cleanup_attacker_associations(
                session, war_id, battlegroup, placement_request.node_number, old_attacker_id
            )
        return await cls._placement_response(session, placement.id)

    @staticmethod
    async def _orphan_synergies(
        session: SessionDep, war_id: uuid.UUID, battlegroup: int, champion_user_id: uuid.UUID
    ) -> Sequence[WarSynergyAttacker]:
        """Synergy rows of a champion that no longer attacks any node of this battlegroup."""
        remaining = await session.exec(
            select(WarDefensePlacement).where(
                WarDefensePlacement.war_id == war_id,
                WarDefensePlacement.battlegroup == battlegroup,
                WarDefensePlacement.attacker_champion_user_id == champion_user_id,
            )
        )
        if remaining.first():
            return []
        return (
            await session.exec(
                select(WarSynergyAttacker).where(
                    WarSynergyAttacker.war_id == war_id,
                    WarSynergyAttacker.battlegroup == battlegroup,
                    or_(
                        col(WarSynergyAttacker.champion_user_id) == champion_user_id,
                        col(WarSynergyAttacker.target_champion_user_id) == champion_user_id,
                    ),
                )
            )
        ).all()

    @classmethod
    async def _cleanup_attacker_associations(
        cls,
        session: SessionDep,
        war_id: uuid.UUID,
        battlegroup: int,
        node_number: int | None,
        attacker_champion_user_id: uuid.UUID | None,
    ) -> None:
        """Drop the node's prefights and, if the attacker holds no other node, its synergy rows.

        Call *after* the attacker is detached / the placement deleted. ``node_number=None`` keeps the prefights.
        """
        stale: list[WarSynergyAttacker | WarPrefightAttacker] = []
        if attacker_champion_user_id is not None:
            stale += await cls._orphan_synergies(
                session, war_id, battlegroup, attacker_champion_user_id
            )
        if node_number is not None:
            stale += (
                await session.exec(
                    select(WarPrefightAttacker).where(
                        WarPrefightAttacker.war_id == war_id,
                        WarPrefightAttacker.battlegroup == battlegroup,
                        WarPrefightAttacker.target_node_number == node_number,
                    )
                )
            ).all()
        for row in stale:
            await session.delete(row)
        await session.commit()

    @classmethod
    async def remove_defender(
        cls, session: SessionDep, war_id: uuid.UUID, battlegroup: int, node_number: int
    ) -> None:
        placement = await cls._require_placement(session, war_id, battlegroup, node_number)
        await cls._assert_attacker_unlocked(session, placement)
        # Synergy/prefight rows don't FK the placement, so they are dropped by hand;
        # the note survives via its SET NULL FK.
        attacker_champion_user_id = placement.attacker_champion_user_id
        await FightRecordService.drop_node_record(session, placement.id)
        await session.delete(placement)
        await session.commit()
        await cls._cleanup_attacker_associations(
            session, war_id, battlegroup, node_number, attacker_champion_user_id
        )

    @classmethod
    async def clear_bg(cls, session: SessionDep, war_id: uuid.UUID, battlegroup: int) -> int:
        ClosedWarPolicy.assert_open(await session.get_one(War, war_id))
        placements = (
            await session.exec(
                select(WarDefensePlacement).where(
                    WarDefensePlacement.war_id == war_id,
                    WarDefensePlacement.battlegroup == battlegroup,
                )
            )
        ).all()
        for p in placements:
            await session.delete(p)
        for model in (WarSynergyAttacker, WarPrefightAttacker):
            rows = await session.exec(
                select(model).where(model.war_id == war_id, model.battlegroup == battlegroup)
            )
            for row in rows.all():
                await session.delete(row)
        await session.commit()
        return len(placements)

    # ─── Attackers ────────────────────────────────────────────────────────────

    @staticmethod
    async def _taken_attackers(
        session: SessionDep, war_id: uuid.UUID, battlegroup: int, exclude_node: int | None = None
    ) -> dict[uuid.UUID, set[uuid.UUID]]:
        """Per account: champions already used (nodes + synergy + prefight), minus exclude_node's attacker."""
        taken: dict[uuid.UUID, set[uuid.UUID]] = defaultdict(set)
        node_rows = await session.exec(
            select(
                ChampionUser.game_account_id,
                WarDefensePlacement.attacker_champion_user_id,
                WarDefensePlacement.node_number,
            )
            .join(
                ChampionUser, col(WarDefensePlacement.attacker_champion_user_id) == ChampionUser.id
            )
            .where(
                WarDefensePlacement.war_id == war_id, WarDefensePlacement.battlegroup == battlegroup
            )
        )
        for account_id, champion_user_id, node in node_rows.all():
            if node != exclude_node:
                taken[account_id].add(champion_user_id)
        for model in (WarSynergyAttacker, WarPrefightAttacker):
            rows = await session.exec(
                select(model.game_account_id, model.champion_user_id, model.champion_id).where(
                    model.war_id == war_id, model.battlegroup == battlegroup
                )
            )
            for account_id, champion_user_id, champion_id in rows.all():
                # An Unrecorded Copy is keyed by its champion: one slot whatever the node count.
                taken[account_id].add(champion_user_id or champion_id)
        return taken

    @staticmethod
    async def _load_champion_user(
        session: SessionDep, champion_user_id: uuid.UUID, missing: str = CHAMPION_USER_NOT_FOUND
    ) -> ChampionUser:
        champion_user = (
            await session.exec(
                select(ChampionUser)
                .where(ChampionUser.id == champion_user_id)
                .options(
                    selectinload(ChampionUser.game_account),  # type: ignore[arg-type]
                    selectinload(ChampionUser.champion),  # type: ignore[arg-type]
                )
            )
        ).first()
        if champion_user is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, missing)
        return champion_user

    @staticmethod
    def _assert_in_bg(game_account: GameAccount, alliance_id: uuid.UUID, battlegroup: int) -> None:
        if game_account.alliance_id != alliance_id or game_account.alliance_group != battlegroup:
            raise HTTPException(status.HTTP_403_FORBIDDEN, CHAMPION_NOT_IN_ALLIANCE_BG)

    @staticmethod
    def _assert_not_banned(war: War, champion_id: uuid.UUID) -> None:
        if champion_id in {ban.champion_id for ban in war.bans}:
            raise HTTPException(status.HTTP_409_CONFLICT, CHAMPION_BANNED_FOR_WAR)

    @classmethod
    async def _assert_quota(
        cls,
        session: SessionDep,
        war: War,
        battlegroup: int,
        game_account_id: uuid.UUID,
        slot: uuid.UUID,
        exclude_node: int | None = None,
    ) -> None:
        max_attackers = for_format(await cls._war_format(session, war)).max_attackers_per_member
        taken = await cls._taken_attackers(session, war.id, battlegroup, exclude_node)
        if len(taken[game_account_id] | {slot}) > max_attackers:
            raise HTTPException(
                status.HTTP_409_CONFLICT, member_max_attackers_reached(max_attackers)
            )

    @classmethod
    async def _assert_can_attack(
        cls,
        session: SessionDep,
        war: War,
        alliance_id: uuid.UUID,
        battlegroup: int,
        champion_user: ChampionUser,
        exclude_node: int | None = None,
    ) -> None:
        """Not banned, not on alliance defense, and within the member's attacker cap."""
        cls._assert_not_banned(war, champion_user.champion_id)
        fmt = await cls._war_format(session, war)
        on_defense = await session.exec(
            DefensePlanService.active_defender_ids(alliance_id, fmt, battlegroup).where(
                DefensePlanNode.champion_user_id == champion_user.id
            )
        )
        if on_defense.first():
            raise HTTPException(status.HTTP_409_CONFLICT, CHAMPION_ALREADY_IN_ALLIANCE_DEFENSE)
        await cls._assert_quota(
            session, war, battlegroup, champion_user.game_account_id, champion_user.id, exclude_node
        )

    @classmethod
    async def _assert_can_bring_unrecorded(
        cls,
        session: SessionDep,
        war: War,
        alliance_id: uuid.UUID,
        battlegroup: int,
        game_account_id: uuid.UUID,
        champion_id: uuid.UUID,
    ) -> None:
        """An Unrecorded Copy stands in only when every recorded copy is on defense."""
        cls._assert_not_banned(war, champion_id)
        on_defense = DefensePlanService.active_defender_ids(
            alliance_id, await cls._war_format(session, war), battlegroup
        ).scalar_subquery()
        free_copy = await session.exec(
            select(ChampionUser.id).where(
                ChampionUser.game_account_id == game_account_id,
                ChampionUser.champion_id == champion_id,
                col(ChampionUser.id).not_in(on_defense),
            )
        )
        if free_copy.first():
            raise HTTPException(status.HTTP_409_CONFLICT, CHAMPION_HAS_RECORDED_COPY)
        await cls._assert_quota(session, war, battlegroup, game_account_id, champion_id)

    @classmethod
    async def _assert_can_provide(
        cls,
        session: SessionDep,
        war: War,
        alliance_id: uuid.UUID,
        battlegroup: int,
        champion_user: ChampionUser | None,
        game_account_id: uuid.UUID,
        champion_id: uuid.UUID,
    ) -> None:
        """A synergy or pre-fight provider: a roster entry, or else an Unrecorded Copy."""
        if champion_user is not None:
            await cls._assert_can_attack(session, war, alliance_id, battlegroup, champion_user)
        else:
            await cls._assert_can_bring_unrecorded(
                session, war, alliance_id, battlegroup, game_account_id, champion_id
            )

    @staticmethod
    async def _defender_ids(
        session: SessionDep, alliance_id: uuid.UUID, fmt: SeasonFormat, battlegroup: int
    ) -> set[uuid.UUID]:
        stmt = DefensePlanService.active_defender_ids(alliance_id, fmt, battlegroup)
        return set((await session.exec(stmt)).all())

    @staticmethod
    async def _load_champion(session: SessionDep, champion_id: uuid.UUID | None) -> Champion:
        champion = None if champion_id is None else await session.get(Champion, champion_id)
        if champion is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, CHAMPION_NOT_FOUND)
        return champion

    @classmethod
    async def _assert_node_on_map(cls, session: SessionDep, war: War, node_number: int) -> None:
        node_count = for_format(await cls._war_format(session, war)).node_count
        if node_number < 1 or node_number > node_count:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, node_exceeds_map(node_count))

    @classmethod
    async def get_available_attackers(
        cls,
        session: SessionDep,
        alliance_id: uuid.UUID,
        battlegroup: int,
        attacker_id: uuid.UUID | None = None,
        war: War | None = None,
        node_number: int | None = None,
        include_defense: bool = False,
    ) -> list[AvailableAttackerResponse]:
        fmt = await cls._war_format(session, war)
        max_attackers = for_format(fmt).max_attackers_per_member
        stmt = (
            select(GameAccount)
            .where(
                GameAccount.alliance_id == alliance_id, GameAccount.alliance_group == battlegroup
            )
            .options(selectinload(GameAccount.roster).selectinload(ChampionUser.champion))  # type: ignore[arg-type]
        )
        if attacker_id is not None:
            stmt = stmt.where(GameAccount.id == attacker_id)
        members = (await session.exec(stmt)).all()

        on_defense = await cls._defender_ids(session, alliance_id, fmt, battlegroup)
        banned = {ban.champion_id for ban in war.bans} if war else set()
        taken = await cls._taken_attackers(session, war.id, battlegroup, node_number) if war else {}
        saga = await SagaService.resolve_current(session)
        result: list[AvailableAttackerResponse] = []
        for game_account in members:
            used = taken.get(game_account.id, set())
            full = len(used) >= max_attackers
            for cu in game_account.roster:
                is_on_defense = cu.id in on_defense
                if (
                    (is_on_defense and not include_defense)
                    or cu.champion_id in banned
                    or (
                        full
                        and cu.id not in used
                        and not (is_on_defense and cu.champion_id in used)
                    )
                ):
                    continue
                att, dfn = saga.get(cu.champion_id, NO_SAGA)
                result.append(
                    AvailableAttackerResponse(
                        champion_user_id=cu.id,
                        game_account_id=game_account.id,
                        game_pseudo=game_account.game_pseudo,
                        champion_id=cu.champion_id,
                        champion_name=cu.champion.name,
                        champion_alias=cu.champion.alias,
                        champion_class=cu.champion.champion_class,
                        image_url=cu.champion.image_url,
                        rarity=cu.rarity,
                        ascension=cu.ascension,
                        signature=cu.signature,
                        is_preferred_attacker=cu.is_preferred_attacker,
                        is_saga_attacker=att,
                        is_saga_defender=dfn,
                        is_on_defense=is_on_defense,
                    )
                )
        return result

    @classmethod
    async def get_available_prefight_attackers(
        cls,
        session: SessionDep,
        alliance_id: uuid.UUID,
        battlegroup: int,
        war: War | None = None,
        include_defense: bool = False,
    ) -> list[AvailablePrefightAttackerResponse]:
        fmt = await cls._war_format(session, war)
        on_defense = await cls._defender_ids(session, alliance_id, fmt, battlegroup)
        stmt = (
            select(ChampionUser, GameAccount, Champion)
            .join(GameAccount, col(ChampionUser.game_account_id) == GameAccount.id)
            .join(Champion, col(ChampionUser.champion_id) == Champion.id)
            .where(
                GameAccount.alliance_id == alliance_id,
                GameAccount.alliance_group == battlegroup,
                col(Champion.has_prefight).is_(True),
            )
        )
        if not include_defense and on_defense:
            stmt = stmt.where(col(ChampionUser.id).not_in(on_defense))
        if war and war.bans:
            stmt = stmt.where(
                col(ChampionUser.champion_id).not_in([b.champion_id for b in war.bans])
            )

        def strength(cu: ChampionUser) -> tuple[bool, int, int, int]:
            return (cu.id not in on_defense, *_copy_strength(cu))

        # One entry per player and champion: the highest copy stands, a free one before a defender.
        best: dict[tuple[uuid.UUID, uuid.UUID], tuple[ChampionUser, GameAccount, Champion]] = {}
        for cu, ga, champ in (await session.exec(stmt)).all():  # type: ignore[arg-type]
            kept = best.get((ga.id, cu.champion_id))
            if kept is None or strength(cu) > strength(kept[0]):
                best[(ga.id, cu.champion_id)] = (cu, ga, champ)

        saga = await SagaService.resolve_current(session)
        result: list[AvailablePrefightAttackerResponse] = []
        for cu, ga, champ in best.values():
            att, dfn = saga.get(cu.champion_id, NO_SAGA)
            result.append(
                AvailablePrefightAttackerResponse(
                    champion_user_id=cu.id,
                    game_account_id=ga.id,
                    game_pseudo=ga.game_pseudo,
                    champion_id=cu.champion_id,
                    champion_name=champ.name,
                    champion_alias=champ.alias,
                    image_url=champ.image_url,
                    is_preferred_attacker=cu.is_preferred_attacker,
                    is_saga_attacker=att,
                    is_saga_defender=dfn,
                    is_on_defense=cu.id in on_defense,
                )
            )
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
        war = await cls._load_war(session, war_id)
        await cls._assert_node_on_map(session, war, node_number)
        placement = await cls._get_placement_by_node(session, war_id, battlegroup, node_number)
        if placement is None:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT, NODE_HAS_NO_DEFENDER_PLACE_FIRST
            )
        cls._assert_not_completed(placement)
        if placement.attacker_champion_user_id is not None:
            await cls._assert_attacker_unlocked(session, placement)

        champion_user = await cls._load_champion_user(session, champion_user_id)
        cls._assert_in_bg(champion_user.game_account, alliance_id, battlegroup)
        await cls._assert_can_attack(
            session, war, alliance_id, battlegroup, champion_user, exclude_node=node_number
        )

        previous_attacker_id = placement.attacker_champion_user_id
        attacker_changed = previous_attacker_id != champion_user_id
        placement.attacker_champion_user_id = champion_user_id
        await session.commit()
        session.expire(placement, ["attacker_champion_user"])
        await FightRecordService.sync_node(session, placement.id, refreeze=attacker_changed)
        if attacker_changed:
            # The node's prefights still apply to the new attacker; only the old one's synergies go.
            await cls._cleanup_attacker_associations(
                session, war_id, battlegroup, None, previous_attacker_id
            )
        return await cls._placement_response(session, placement.id)

    @classmethod
    async def remove_attacker(
        cls, session: SessionDep, war_id: uuid.UUID, battlegroup: int, node_number: int
    ) -> WarPlacementResponse:
        placement = await cls._require_placement(session, war_id, battlegroup, node_number)
        if placement.attacker_champion_user_id is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, NO_ATTACKER_ASSIGNED_ON_NODE)
        cls._assert_not_completed(placement)
        await cls._assert_attacker_unlocked(session, placement)

        removed_champion_user_id = placement.attacker_champion_user_id
        placement.attacker_champion_user_id = None
        placement.ko_count = 0
        placement.war_boost = None
        placement.has_defense_boost = False
        placement.has_power_boost = False
        placement.has_specials_boost = False
        await session.commit()
        await FightRecordService.sync_node(session, placement.id)
        await cls._cleanup_attacker_associations(
            session, war_id, battlegroup, node_number, removed_champion_user_id
        )
        return await cls._placement_response(session, placement.id)

    @classmethod
    async def _require_active_attacker(
        cls,
        session: SessionDep,
        war_id: uuid.UUID,
        battlegroup: int,
        node_number: int,
        missing: str,
    ) -> WarDefensePlacement:
        """Placement with an attacker and an unfinished fight; `missing` is the 400 detail."""
        placement = await cls._require_placement(session, war_id, battlegroup, node_number)
        if placement.attacker_champion_user_id is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, missing)
        cls._assert_not_completed(placement)
        return placement

    @classmethod
    async def update_boosts(
        cls,
        session: SessionDep,
        war_id: uuid.UUID,
        battlegroup: int,
        node_number: int,
        boosts: WarBoostUpdateRequest,
    ) -> WarPlacementResponse:
        placement = await cls._require_active_attacker(
            session, war_id, battlegroup, node_number, BOOSTS_NO_ATTACKER_ASSIGNED
        )
        placement.war_boost = boosts.war_boost
        placement.has_defense_boost = boosts.has_defense_boost
        placement.has_power_boost = boosts.has_power_boost
        placement.has_specials_boost = boosts.has_specials_boost
        await session.commit()
        return await cls._placement_response(session, placement.id)

    @classmethod
    async def update_ko(
        cls,
        session: SessionDep,
        war_id: uuid.UUID,
        battlegroup: int,
        node_number: int,
        ko_count: KoCount,
    ) -> WarPlacementResponse:
        placement = await cls._require_active_attacker(
            session, war_id, battlegroup, node_number, KO_COUNT_NO_ATTACKER_ASSIGNED
        )
        max_ko = for_format(
            await cls._war_format(session, await cls._load_war(session, war_id))
        ).max_ko_count
        if ko_count > max_ko:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT, ko_count_exceeds_format(max_ko)
            )
        placement.ko_count = ko_count
        await session.commit()
        return await cls._placement_response(session, placement.id)

    @classmethod
    async def toggle_combat_completed(
        cls, session: SessionDep, war_id: uuid.UUID, battlegroup: int, node_number: int
    ) -> WarPlacementResponse:
        placement = await cls._require_placement(session, war_id, battlegroup, node_number)
        if placement.attacker_champion_user_id is None:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, NO_ATTACKER_ASSIGNED_ON_NODE)
        placement.is_combat_completed = not placement.is_combat_completed
        await session.commit()
        return await cls._placement_response(session, placement.id)

    @classmethod
    async def toggle_fight_not_done(
        cls, session: SessionDep, war_id: uuid.UUID, battlegroup: int, node_number: int
    ) -> WarPlacementResponse:
        placement = await cls._require_placement(session, war_id, battlegroup, node_number)
        if placement.attacker_champion_user_id is None:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT, NO_ATTACKER_ASSIGNED_FOR_FLAG
            )
        cls._assert_not_completed(placement)
        if not placement.is_fight_not_done and placement.is_planning_error:
            raise HTTPException(status.HTTP_409_CONFLICT, PLANNING_ERROR_CONFLICT)
        placement.is_fight_not_done = not placement.is_fight_not_done
        await session.commit()
        await FightRecordService.sync_node(session, placement.id)
        return await cls._placement_response(session, placement.id)

    @classmethod
    async def toggle_planning_error(
        cls, session: SessionDep, war_id: uuid.UUID, battlegroup: int, node_number: int
    ) -> WarPlacementResponse:
        placement = await cls._require_placement(session, war_id, battlegroup, node_number)
        if not placement.is_planning_error and placement.is_fight_not_done:
            raise HTTPException(status.HTTP_409_CONFLICT, FIGHT_NOT_DONE_CONFLICT)
        placement.is_planning_error = not placement.is_planning_error
        await session.commit()
        return await cls._placement_response(session, placement.id)

    @classmethod
    async def assign_assist(
        cls,
        session: SessionDep,
        war_id: uuid.UUID,
        alliance_id: uuid.UUID,
        battlegroup: int,
        node_number: int,
        champion_user_id: uuid.UUID,
    ) -> WarPlacementResponse:
        placement = await cls._require_placement(session, war_id, battlegroup, node_number)
        if placement.attacker_champion_user_id is None:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, ASSIST_NO_ATTACKER_ASSIGNED)
        assistor = await cls._load_champion_user(session, champion_user_id)
        cls._assert_in_bg(assistor.game_account, alliance_id, battlegroup)
        attacker = await session.get(ChampionUser, placement.attacker_champion_user_id)
        if attacker and attacker.game_account_id == assistor.game_account_id:
            raise HTTPException(status.HTTP_409_CONFLICT, ASSIST_SAME_ACCOUNT)

        placement.assist_champion_user_id = champion_user_id
        await session.commit()
        session.expire(placement, ["assist_champion_user"])
        return await cls._placement_response(session, placement.id)

    @classmethod
    async def remove_assist(
        cls, session: SessionDep, war_id: uuid.UUID, battlegroup: int, node_number: int
    ) -> WarPlacementResponse:
        placement = await cls._require_placement(session, war_id, battlegroup, node_number)
        if placement.assist_champion_user_id is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, ASSIST_NOT_FOUND)
        placement.assist_champion_user_id = None
        await session.commit()
        session.expire(placement, ["assist_champion_user"])
        return await cls._placement_response(session, placement.id)

    # ─── Synergy & prefight ───────────────────────────────────────────────────

    @classmethod
    async def _unrecorded_reasons(
        cls,
        session: SessionDep,
        alliance_id: uuid.UUID,
        war: War,
        battlegroup: int,
        keys: set[tuple[uuid.UUID, uuid.UUID]],
    ) -> dict[tuple[uuid.UUID, uuid.UUID], UnrecordedReason]:
        """Per (account, champion): a free recorded copy beats one on defense; none means not in roster."""
        on_defense = await cls._defender_ids(
            session, alliance_id, await cls._war_format(session, war), battlegroup
        )
        copies = await session.exec(
            select(ChampionUser.id, ChampionUser.game_account_id, ChampionUser.champion_id).where(
                col(ChampionUser.game_account_id).in_({account for account, _ in keys}),
                col(ChampionUser.champion_id).in_({champion for _, champion in keys}),
            )
        )
        reasons = dict.fromkeys(keys, UnrecordedReason.NOT_IN_ROSTER)
        for cu_id, account_id, champion_id in copies.all():
            key = (account_id, champion_id)
            if key not in reasons or reasons[key] == UnrecordedReason.RECORDED_COPY_FREE:
                continue
            reasons[key] = (
                UnrecordedReason.ON_DEFENSE
                if cu_id in on_defense
                else UnrecordedReason.RECORDED_COPY_FREE
            )
        return reasons

    @classmethod
    async def _entry_dtos[T: (WarSynergyResponse, WarPrefightResponse)](
        cls,
        session: SessionDep,
        dto_cls: type[T],
        rows: Sequence[WarSynergyAttacker] | Sequence[WarPrefightAttacker],
        alliance_id: uuid.UUID,
        war: War,
        battlegroup: int,
    ) -> list[T]:
        saga = await SagaService.resolve_current(session)
        keys = {(r.game_account_id, r.champion_id) for r in rows if r.champion_user_id is None}
        reasons = (
            await cls._unrecorded_reasons(session, alliance_id, war, battlegroup, keys)
            if keys
            else {}
        )
        dtos = []
        for row in rows:
            dto = dto_cls.model_validate(row)
            dto.is_saga_attacker, dto.is_saga_defender = saga.get(row.champion_id, NO_SAGA)
            if row.champion_user_id is None:
                dto.unrecorded_reason = reasons[(row.game_account_id, row.champion_id)]
            dtos.append(dto)
        return dtos

    @classmethod
    async def get_synergy_attackers(
        cls, session: SessionDep, war_id: uuid.UUID, alliance_id: uuid.UUID, battlegroup: int
    ) -> list[WarSynergyResponse]:
        war = await cls._load_war(session, war_id)
        rows = (
            await session.exec(
                select(WarSynergyAttacker)
                .where(
                    WarSynergyAttacker.war_id == war_id,
                    WarSynergyAttacker.battlegroup == battlegroup,
                )
                .options(*_SYNERGY_OPTIONS)
            )
        ).all()
        return await cls._entry_dtos(
            session, WarSynergyResponse, rows, alliance_id, war, battlegroup
        )

    @classmethod
    async def add_synergy_attacker(
        cls,
        session: SessionDep,
        war_id: uuid.UUID,
        alliance_id: uuid.UUID,
        battlegroup: int,
        target_champion_user_id: uuid.UUID,
        champion_user_id: uuid.UUID | None = None,
        champion_id: uuid.UUID | None = None,
    ) -> WarSynergyResponse:
        target = await cls._load_champion_user(
            session, target_champion_user_id, TARGET_CHAMPION_USER_NOT_FOUND
        )
        champion_user = None
        if champion_user_id is not None:
            if champion_user_id == target_champion_user_id:
                raise HTTPException(status.HTTP_409_CONFLICT, SYNERGY_PROVIDER_CANNOT_BE_TARGET)
            champion_user = await cls._load_champion_user(session, champion_user_id)
            if champion_user.game_account.user_id != target.game_account.user_id:
                raise HTTPException(status.HTTP_403_FORBIDDEN, ONLY_OWN_CHAMPIONS_SYNERGY)
            game_account, champion_id = champion_user.game_account, champion_user.champion_id
        else:
            if champion_id == target.champion_id:
                raise HTTPException(status.HTTP_409_CONFLICT, SYNERGY_PROVIDER_CANNOT_BE_TARGET)
            champion_id = (await cls._load_champion(session, champion_id)).id
            game_account = target.game_account
        cls._assert_in_bg(game_account, alliance_id, battlegroup)

        target_on_node = await session.exec(
            select(WarDefensePlacement).where(
                WarDefensePlacement.war_id == war_id,
                WarDefensePlacement.battlegroup == battlegroup,
                WarDefensePlacement.attacker_champion_user_id == target_champion_user_id,
            )
        )
        if target_on_node.first() is None:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT, TARGET_NOT_ASSIGNED_AS_NODE_ATTACKER
            )

        war = await cls._load_war(session, war_id)
        await cls._assert_can_provide(
            session, war, alliance_id, battlegroup, champion_user, game_account.id, champion_id
        )

        synergy = WarSynergyAttacker(
            war_id=war_id,
            battlegroup=battlegroup,
            game_account_id=game_account.id,
            champion_user_id=champion_user_id,
            champion_id=champion_id,
            target_champion_user_id=target_champion_user_id,
        )
        session.add(synergy)
        try:
            await session.commit()
        except IntegrityError as exc:
            await session.rollback()
            raise HTTPException(
                status.HTTP_409_CONFLICT, CHAMPION_ALREADY_SYNERGY_PROVIDER
            ) from exc

        loaded = (
            await session.exec(
                select(WarSynergyAttacker)
                .where(WarSynergyAttacker.id == synergy.id)
                .options(*_SYNERGY_OPTIONS)
            )
        ).one()
        return (
            await cls._entry_dtos(
                session, WarSynergyResponse, [loaded], alliance_id, war, battlegroup
            )
        )[0]

    @classmethod
    async def remove_synergy_attacker(
        cls, session: SessionDep, war_id: uuid.UUID, battlegroup: int, synergy_id: uuid.UUID
    ) -> None:
        synergy = await session.get(WarSynergyAttacker, synergy_id)
        if synergy is None or synergy.war_id != war_id or synergy.battlegroup != battlegroup:
            raise HTTPException(status.HTTP_404_NOT_FOUND, SYNERGY_ATTACKER_NOT_FOUND)
        await session.delete(synergy)
        await session.commit()

    @classmethod
    async def get_prefight_attackers(
        cls, session: SessionDep, war_id: uuid.UUID, alliance_id: uuid.UUID, battlegroup: int
    ) -> list[WarPrefightResponse]:
        war = await cls._load_war(session, war_id)
        rows = (
            await session.exec(
                select(WarPrefightAttacker)
                .where(
                    WarPrefightAttacker.war_id == war_id,
                    WarPrefightAttacker.battlegroup == battlegroup,
                )
                .options(*_PREFIGHT_OPTIONS)
            )
        ).all()
        return await cls._entry_dtos(
            session, WarPrefightResponse, rows, alliance_id, war, battlegroup
        )

    @classmethod
    async def add_prefight_attacker(
        cls,
        session: SessionDep,
        war_id: uuid.UUID,
        alliance_id: uuid.UUID,
        battlegroup: int,
        target_node_number: int,
        champion_user_id: uuid.UUID | None = None,
        champion_id: uuid.UUID | None = None,
        game_account_id: uuid.UUID | None = None,
    ) -> WarPrefightResponse:
        war = await cls._load_war(session, war_id)
        await cls._assert_node_on_map(session, war, target_node_number)
        champion_user = None
        if champion_user_id is not None:
            champion_user = await cls._load_champion_user(session, champion_user_id)
            champion, game_account = champion_user.champion, champion_user.game_account
        else:
            champion = await cls._load_champion(session, champion_id)
            game_account = await session.get(GameAccount, game_account_id)
            if game_account is None:
                raise HTTPException(status.HTTP_404_NOT_FOUND, GAME_ACCOUNT_NOT_FOUND)
        if not champion.has_prefight:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, CHAMPION_NO_PREFIGHT_ABILITY)
        cls._assert_in_bg(game_account, alliance_id, battlegroup)

        target = await cls._get_placement_by_node(session, war_id, battlegroup, target_node_number)
        if target is None:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT, TARGET_NODE_NO_DEFENDER_IN_WAR_BG
            )
        if target.attacker_champion_user_id is None:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT, TARGET_NODE_NO_ATTACKER_ASSIGNED
            )

        await cls._assert_can_provide(
            session, war, alliance_id, battlegroup, champion_user, game_account.id, champion.id
        )

        prefight = WarPrefightAttacker(
            war_id=war_id,
            battlegroup=battlegroup,
            game_account_id=game_account.id,
            champion_user_id=champion_user_id,
            champion_id=champion.id,
            target_node_number=target_node_number,
        )
        session.add(prefight)
        try:
            await session.commit()
        except IntegrityError as exc:
            await session.rollback()
            raise HTTPException(
                status.HTTP_409_CONFLICT, CHAMPION_ALREADY_PREFIGHT_ON_NODE
            ) from exc

        loaded = (
            await session.exec(
                select(WarPrefightAttacker)
                .where(WarPrefightAttacker.id == prefight.id)
                .options(*_PREFIGHT_OPTIONS)
            )
        ).one()
        return (
            await cls._entry_dtos(
                session, WarPrefightResponse, [loaded], alliance_id, war, battlegroup
            )
        )[0]

    @classmethod
    async def remove_prefight_attacker(
        cls, session: SessionDep, war_id: uuid.UUID, battlegroup: int, prefight_id: uuid.UUID
    ) -> None:
        prefight = await session.get(WarPrefightAttacker, prefight_id)
        if prefight is None or prefight.war_id != war_id or prefight.battlegroup != battlegroup:
            raise HTTPException(status.HTTP_404_NOT_FOUND, PREFIGHT_ENTRY_NOT_FOUND)
        await session.delete(prefight)
        await session.commit()

import uuid
from collections import defaultdict
from typing import Optional

from sqlalchemy.orm import selectinload
from sqlmodel import select

from fastapi import HTTPException, status

from src.dto.alliance.dto_matchup import (
    ChampionRef,
    MatchupDefenderGridCell,
    MatchupDefenderGridResponse,
    MatchupDefenderGridRow,
    MatchupEvaluationRow,
    MatchupGridAxisEntry,
    MatchupGridCell,
    MatchupGridResponse,
    MatchupSynergyResponse,
    MatchupUpsertRequest,
)
from src.enums.MatchupTargetType import MatchupTargetType
from src.Messages.matchup_messages import (
    CHAMPION_NOT_FOUND,
    GAME_ACCOUNT_NOT_IN_ALLIANCE,
    MATCHUP_NOT_FOUND,
)
from src.models.Champion import Champion
from src.models.ChampionUser import ChampionUser
from src.models.DefensePlacement import DefensePlacement
from src.models.GameAccount import GameAccount
from src.models.MatchupRating import MatchupRating
from src.models.MatchupSynergy import MatchupSynergy
from src.models.Base import utcnow
from src.services.alliance.matchup_scoring import (
    build_target_key,
    combine_verdicts,
    format_instance_label,
    resolve_missing_champions,
)
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
        await cls._assert_champions_exist(session, request)

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

    @staticmethod
    async def _assert_champions_exist(session: SessionDep, request: MatchupUpsertRequest) -> None:
        """Reject unknown champion ids with a 404 rather than a raw IntegrityError.

        Four fields carry champion ids — the attacker, the defender, the prefight, and each
        synergy. A stale id from a client would otherwise surface as a 500 at commit time.
        """
        referenced = {request.champion_id}
        for target in request.targets:
            if target.defender_champion_id is not None:
                referenced.add(target.defender_champion_id)
            if target.prefight_champion_id is not None:
                referenced.add(target.prefight_champion_id)
            referenced.update(synergy.champion_id for synergy in target.synergies)

        found = (await session.exec(select(Champion.id).where(Champion.id.in_(referenced)))).all()
        if len(set(found)) != len(referenced):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=CHAMPION_NOT_FOUND)

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

    @classmethod
    async def evaluate(
        cls,
        session: SessionDep,
        alliance_id: uuid.UUID,
        defender_champion_id: Optional[uuid.UUID] = None,
        node_number: Optional[int] = None,
        champion_id: Optional[uuid.UUID] = None,
        game_account_id: Optional[uuid.UUID] = None,
    ) -> list[MatchupEvaluationRow]:
        """Rank the alliance's rated attackers against the selected defender and/or node.

        A champion surfaces only if it carries at least one rating: the matrix is sparse on
        purpose, and so is the output. When ``game_account_id`` is given, each row also says
        whether that player can actually take the fight.
        """
        if game_account_id is not None:
            await cls._assert_game_account_in_alliance(session, alliance_id, game_account_id)

        ratings = await cls._ratings_for_targets(
            session, alliance_id, defender_champion_id, node_number, champion_id
        )
        by_champion: dict[uuid.UUID, dict[MatchupTargetType, MatchupRating]] = defaultdict(dict)
        for rating in ratings:
            by_champion[rating.champion_id][rating.target_type] = rating

        owned, on_defense = await cls._roster_context(session, alliance_id, game_account_id)

        rows = [
            cls._build_row(targets, owned, on_defense, game_account_id)
            for targets in by_champion.values()
        ]
        # `score` is None exactly when `is_discouraged`, so the first key already segregates them.
        # Sorting on `score is None` next makes that dependency explicit instead of leaning on
        # `or 0`, which would read as "no score == zero score" — the one conflation this feature
        # exists to prevent.
        rows.sort(
            key=lambda row: (
                row.is_discouraged,
                row.score is None,
                -(row.score or 0),
                row.champion.champion_name,
            )
        )
        return rows

    @classmethod
    async def evaluate_grid(
        cls,
        session: SessionDep,
        alliance_id: uuid.UUID,
        champion_id: uuid.UUID,
        game_account_id: Optional[uuid.UUID] = None,
    ) -> MatchupGridResponse:
        """Build the attacker-centric grid: every rated defender x every rated node.

        Player-awareness (`is_owned`, `instance_label`, `is_on_defense`) is reported for the
        attacker only — per-cell required-synergy greying is deliberately out of scope here.
        """
        champion = (await session.exec(select(Champion).where(Champion.id == champion_id))).first()
        if champion is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=CHAMPION_NOT_FOUND)

        if game_account_id is not None:
            await cls._assert_game_account_in_alliance(session, alliance_id, game_account_id)

        ratings = (
            await session.exec(
                select(MatchupRating)
                .where(
                    MatchupRating.alliance_id == alliance_id,
                    MatchupRating.champion_id == champion_id,
                )
                .options(*cls._RATING_RELATIONS)
            )
        ).all()

        defender_ratings = [r for r in ratings if r.target_type is MatchupTargetType.DEFENDER]
        node_ratings = [r for r in ratings if r.target_type is MatchupTargetType.NODE]
        # A champion carries zero ratings the first time it is opened from the grid — fall
        # back to a direct fetch so the attacker ref still renders against empty axes.
        attacker_champion = ratings[0].champion if ratings else champion

        cells: list[MatchupGridCell] = []
        for defender_rating in defender_ratings:
            for node_rating in node_ratings:
                is_discouraged, score = combine_verdicts(
                    defender_rating.verdict, node_rating.verdict
                )
                cells.append(
                    MatchupGridCell(
                        defender_champion_id=defender_rating.defender_champion_id,
                        node_number=node_rating.node_number,
                        is_discouraged=is_discouraged,
                        score=score,
                    )
                )

        owned, on_defense = await cls._roster_context(session, alliance_id, game_account_id)
        is_owned: Optional[bool] = None
        instance_label: Optional[str] = None
        is_on_defense: Optional[bool] = None
        if game_account_id is not None:
            is_owned = champion_id in owned
            instance = owned.get(champion_id)
            instance_label = (
                format_instance_label(
                    instance.stars, instance.rank, instance.ascension, instance.signature
                )
                if instance
                else None
            )
            is_on_defense = champion_id in on_defense

        return MatchupGridResponse(
            attacker=cls.champion_ref(attacker_champion),
            is_owned=is_owned,
            instance_label=instance_label,
            is_on_defense=is_on_defense,
            defenders=[cls._grid_axis_entry(rating) for rating in defender_ratings],
            nodes=[cls._grid_axis_entry(rating) for rating in node_ratings],
            cells=cells,
        )

    @classmethod
    def _grid_axis_entry(cls, rating: MatchupRating) -> MatchupGridAxisEntry:
        return MatchupGridAxisEntry(
            defender=(
                cls.champion_ref(rating.defender_champion) if rating.defender_champion else None
            ),
            node_number=rating.node_number,
            verdict=rating.verdict,
            synergies=[
                MatchupSynergyResponse(
                    **cls.champion_ref(synergy.champion).model_dump(),
                    is_required=synergy.is_required,
                )
                for synergy in rating.synergies
            ],
            prefight=(
                cls.champion_ref(rating.prefight_champion) if rating.prefight_champion else None
            ),
        )

    @classmethod
    async def evaluate_defender_grid(
        cls,
        session: SessionDep,
        alliance_id: uuid.UUID,
        defender_champion_id: uuid.UUID,
        game_account_id: Optional[uuid.UUID] = None,
    ) -> MatchupDefenderGridResponse:
        """Build the defender-centric grid: every rated attacker x each attacker's rated nodes.

        Mirrors `evaluate_grid`, but the fixed axis is the defender instead of the attacker.
        Node columns 1..50 are rendered by the frontend, and per-row ownership is out of scope
        for v1 — `game_account_id` is accepted and validated for signature symmetry only.
        """
        defender_champion = (
            await session.exec(select(Champion).where(Champion.id == defender_champion_id))
        ).first()
        if defender_champion is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=CHAMPION_NOT_FOUND)

        if game_account_id is not None:
            await cls._assert_game_account_in_alliance(session, alliance_id, game_account_id)

        defender_ratings = (
            await session.exec(
                select(MatchupRating)
                .where(
                    MatchupRating.alliance_id == alliance_id,
                    MatchupRating.target_type == MatchupTargetType.DEFENDER,
                    MatchupRating.defender_champion_id == defender_champion_id,
                )
                .options(*cls._RATING_RELATIONS)
            )
        ).all()

        attacker_ids = [rating.champion_id for rating in defender_ratings]
        node_ratings: list[MatchupRating] = []
        if attacker_ids:
            node_ratings = list(
                (
                    await session.exec(
                        select(MatchupRating)
                        .where(
                            MatchupRating.alliance_id == alliance_id,
                            MatchupRating.target_type == MatchupTargetType.NODE,
                            MatchupRating.champion_id.in_(attacker_ids),
                        )
                        .options(*cls._RATING_RELATIONS)
                    )
                ).all()
            )
        nodes_by_attacker: dict[uuid.UUID, list[MatchupRating]] = defaultdict(list)
        for node_rating in node_ratings:
            nodes_by_attacker[node_rating.champion_id].append(node_rating)

        cells: list[MatchupDefenderGridCell] = []
        for defender_rating in defender_ratings:
            for node_rating in nodes_by_attacker.get(defender_rating.champion_id, []):
                is_discouraged, score = combine_verdicts(
                    defender_rating.verdict, node_rating.verdict
                )
                cells.append(
                    MatchupDefenderGridCell(
                        attacker_champion_id=defender_rating.champion_id,
                        node_number=node_rating.node_number,
                        is_discouraged=is_discouraged,
                        score=score,
                    )
                )

        return MatchupDefenderGridResponse(
            defender=cls.champion_ref(defender_champion),
            attackers=[cls._defender_grid_row(rating) for rating in defender_ratings],
            cells=cells,
        )

    @classmethod
    def _defender_grid_row(cls, rating: MatchupRating) -> MatchupDefenderGridRow:
        return MatchupDefenderGridRow(
            attacker=cls.champion_ref(rating.champion),
            verdict=rating.verdict,
            synergies=[
                MatchupSynergyResponse(
                    **cls.champion_ref(synergy.champion).model_dump(),
                    is_required=synergy.is_required,
                )
                for synergy in rating.synergies
            ],
            prefight=(
                cls.champion_ref(rating.prefight_champion) if rating.prefight_champion else None
            ),
        )

    @classmethod
    async def _ratings_for_targets(
        cls,
        session: SessionDep,
        alliance_id: uuid.UUID,
        defender_champion_id: Optional[uuid.UUID],
        node_number: Optional[int],
        champion_id: Optional[uuid.UUID],
    ) -> list[MatchupRating]:
        # Always go through build_target_key: it is the single source of truth for this format,
        # and a hand-rolled f-string here would silently return zero rows if the format changed.
        target_keys = []
        if defender_champion_id is not None:
            target_keys.append(
                build_target_key(MatchupTargetType.DEFENDER, defender_champion_id, None)
            )
        if node_number is not None:
            target_keys.append(build_target_key(MatchupTargetType.NODE, None, node_number))
        if not target_keys:
            return []

        sql = select(MatchupRating).where(
            MatchupRating.alliance_id == alliance_id,
            MatchupRating.target_key.in_(target_keys),
        )
        if champion_id is not None:
            sql = sql.where(MatchupRating.champion_id == champion_id)
        result = await session.exec(sql.options(*cls._RATING_RELATIONS))
        return list(result.all())

    @staticmethod
    def _instance_strength(entry: ChampionUser) -> tuple[int, int, int, int]:
        """Order two instances of the same champion, strongest last."""
        return (entry.stars, entry.rank, entry.ascension, entry.signature)

    @staticmethod
    async def _assert_game_account_in_alliance(
        session: SessionDep, alliance_id: uuid.UUID, game_account_id: uuid.UUID
    ) -> None:
        """Refuse to evaluate against a roster that does not belong to this alliance.

        `game_account_id` is a caller-supplied query parameter. Without this check, any member
        or visitor of alliance A could read the private roster of a player in alliance B —
        which champions they own, and each instance's exact label. The frontend only ever offers
        in-alliance accounts, but a selector is not an authorization boundary.

        The guard lives in the service, not the controller, so every caller inherits it — the v2
        war-assignment code will reuse `evaluate` directly.

        A uniform 404 keeps "no such account" and "not in this alliance" indistinguishable.
        """
        account = (
            await session.exec(select(GameAccount).where(GameAccount.id == game_account_id))
        ).first()
        if account is None or account.alliance_id != alliance_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail=GAME_ACCOUNT_NOT_IN_ALLIANCE
            )

    @classmethod
    async def _roster_context(
        cls, session: SessionDep, alliance_id: uuid.UUID, game_account_id: Optional[uuid.UUID]
    ) -> tuple[dict[uuid.UUID, ChampionUser], set[uuid.UUID]]:
        """Return (champion_id -> strongest owned instance, champion ids whose best is on defense).

        A player can own several instances of one champion — a 6-star and a 7-star Doom are an
        ordinary roster, because `ChampionUserService` deduplicates on champion *and stars*. We
        surface the strongest, and warn only when that instance is the one placed on defense.

        `DefensePlacement` stores `champion_user_id` — the exact instance — so it maps back to a
        champion id through the player's roster.
        """
        if game_account_id is None:
            return {}, set()

        roster = (
            await session.exec(
                select(ChampionUser).where(ChampionUser.game_account_id == game_account_id)
            )
        ).all()
        owned: dict[uuid.UUID, ChampionUser] = {}
        for entry in roster:
            best = owned.get(entry.champion_id)
            if best is None or cls._instance_strength(entry) > cls._instance_strength(best):
                owned[entry.champion_id] = entry

        placements = (
            await session.exec(
                select(DefensePlacement).where(
                    DefensePlacement.alliance_id == alliance_id,
                    DefensePlacement.game_account_id == game_account_id,
                )
            )
        ).all()
        placed = {placement.champion_user_id for placement in placements}
        on_defense = {champion_id for champion_id, entry in owned.items() if entry.id in placed}
        return owned, on_defense

    @staticmethod
    def champion_ref(champion: Champion) -> ChampionRef:
        """Flatten a Champion into the response shape. Public: the controller calls it too."""
        return ChampionRef(
            champion_id=champion.id,
            champion_name=champion.name,
            champion_class=champion.champion_class,
            image_url=champion.image_url,
        )

    @classmethod
    def _build_row(
        cls,
        targets: dict[MatchupTargetType, MatchupRating],
        owned: dict[uuid.UUID, ChampionUser],
        on_defense: set[uuid.UUID],
        game_account_id: Optional[uuid.UUID],
    ) -> MatchupEvaluationRow:
        defender_rating = targets.get(MatchupTargetType.DEFENDER)
        node_rating = targets.get(MatchupTargetType.NODE)
        any_rating = defender_rating or node_rating

        is_discouraged, score = combine_verdicts(
            defender_rating.verdict if defender_rating else None,
            node_rating.verdict if node_rating else None,
        )

        # The unified form attaches the same synergies to BOTH the defender and the node
        # rating, so the two sides overlap by construction. Merge on champion_id, and let
        # `required` win over `recommended` — a synergy demanded by either side is demanded.
        merged: dict[uuid.UUID, MatchupSynergyResponse] = {}
        prefight: Optional[ChampionRef] = None
        for rating in (defender_rating, node_rating):
            if rating is None:
                continue
            for synergy in rating.synergies:
                seen = merged.get(synergy.champion_id)
                if seen is None:
                    merged[synergy.champion_id] = MatchupSynergyResponse(
                        **cls.champion_ref(synergy.champion).model_dump(),
                        is_required=synergy.is_required,
                    )
                elif synergy.is_required:
                    seen.is_required = True
            if rating.prefight_champion is not None and prefight is None:
                prefight = cls.champion_ref(rating.prefight_champion)
        synergies = list(merged.values())

        row = MatchupEvaluationRow(
            champion=cls.champion_ref(any_rating.champion),
            defender_verdict=defender_rating.verdict if defender_rating else None,
            node_verdict=node_rating.verdict if node_rating else None,
            is_discouraged=is_discouraged,
            score=score,
            synergies=synergies,
            prefight=prefight,
        )

        if game_account_id is None:
            return row

        champion_id = any_rating.champion_id
        required_ids = [s.champion_id for s in synergies if s.is_required]
        missing_ids = resolve_missing_champions(champion_id, required_ids, set(owned.keys()))

        by_id = cls._champions_by_id(defender_rating, node_rating, any_rating.champion)
        row.missing_champions = [cls.champion_ref(by_id[cid]) for cid in missing_ids]
        row.is_playable = not missing_ids
        row.is_on_defense = champion_id in on_defense
        instance = owned.get(champion_id)
        row.instance_label = (
            format_instance_label(
                instance.stars, instance.rank, instance.ascension, instance.signature
            )
            if instance
            else None
        )
        return row

    @staticmethod
    def _champions_by_id(
        defender_rating: Optional[MatchupRating],
        node_rating: Optional[MatchupRating],
        attacker: Champion,
    ) -> dict[uuid.UUID, Champion]:
        champions = {attacker.id: attacker}
        for rating in (defender_rating, node_rating):
            if rating is None:
                continue
            for synergy in rating.synergies:
                champions[synergy.champion_id] = synergy.champion
        return champions

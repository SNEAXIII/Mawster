import uuid
from typing import Optional

from fastapi import HTTPException
from starlette import status
from sqlalchemy import union, and_, cast, func, Integer, Float
from sqlmodel import select

from src.models.User import User
from src.models.GameAccount import GameAccount
from src.models.ChampionUser import ChampionUser
from src.models.War import War, WarStatus
from src.models.WarDefensePlacement import WarDefensePlacement
from src.models.Season import Season
from src.models.Alliance import Alliance
from src.models.Champion import Champion
from src.models.WarFightRecord import WarFightRecord
from src.enums.SeasonStatus import SeasonStatus
from src.services.alliance.war._stat_expressions import (
    total_kos,
    total_fights,
    total_not_fought,
)
from src.dto.alliance.war.dto_statistic import NOT_FOUGHT_KOS, ChampionUsageResponse
from src.dto.player.dto_player_stats import (
    PlayerSeasonOption,
    PlayerStatsResponse,
    PlayerStatsCardResponse,
    RatioEvolutionPoint,
    PlayerSeasonAllianceResponse,
)
from src.utils.db import SessionDep


class PlayerStatsService:
    @classmethod
    async def assert_can_view_account(
        cls, session: SessionDep, current_user: User, game_account_id: uuid.UUID
    ) -> GameAccount:
        """Today: only the owner may view. Future officer view extends here only."""
        account = await session.get(GameAccount, game_account_id)
        if account is None or account.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Game account not found"
            )
        return account

    @classmethod
    async def get_player_seasons(
        cls, session: SessionDep, current_user: User, game_account_id: uuid.UUID
    ) -> list[PlayerSeasonOption]:
        await cls.assert_can_view_account(session, current_user, game_account_id)

        # A season counts if the account was the attacker OR the assister in any
        # ended war of that season. UNION deduplicates seasons reached by both legs.
        _season_ids = union(
            select(Season.id)
            .join(War, War.season_id == Season.id)
            .join(WarDefensePlacement, WarDefensePlacement.war_id == War.id)
            .join(
                ChampionUser,
                ChampionUser.id == WarDefensePlacement.attacker_champion_user_id,
            )
            .where(ChampionUser.game_account_id == game_account_id)
            .where(War.status == WarStatus.ended),
            select(Season.id)
            .join(War, War.season_id == Season.id)
            .join(WarDefensePlacement, WarDefensePlacement.war_id == War.id)
            .join(
                ChampionUser,
                ChampionUser.id == WarDefensePlacement.assist_champion_user_id,
            )
            .where(ChampionUser.game_account_id == game_account_id)
            .where(War.status == WarStatus.ended),
        ).subquery()

        stmt = (
            select(Season.id, Season.number, Season.status)
            .join(_season_ids, _season_ids.c.id == Season.id)
            .order_by(Season.number.desc())
        )
        rows = (await session.exec(stmt)).mappings().all()
        return [
            PlayerSeasonOption(
                season_id=r["id"],
                number=r["number"],
                status=r["status"].value if isinstance(r["status"], SeasonStatus) else r["status"],
            )
            for r in rows
        ]

    @classmethod
    async def get_player_stats(
        cls,
        session: SessionDep,
        current_user: User,
        game_account_id: uuid.UUID,
        season_id: Optional[uuid.UUID] = None,
    ) -> PlayerStatsResponse:
        """Composite personal stats for one game account.

        KOs / fights / not-fought / ratio and the evolution chart are
        attacker-based (identical to how the alliance service computes ratio).
        Participation (wars_participated, total_assists, alliances) is
        assist-inclusive: a war where the account only assisted still counts.
        Evolution is grouped by war when a season is given, else by season.
        """
        await cls.assert_can_view_account(session, current_user, game_account_id)

        # --- shared filters ---
        attacker_conds = [
            ChampionUser.game_account_id == game_account_id,
            War.status == WarStatus.ended,
        ]
        assist_conds = [
            ChampionUser.game_account_id == game_account_id,
            War.status == WarStatus.ended,
        ]
        if season_id is not None:
            attacker_conds.append(War.season_id == season_id)
            assist_conds.append(War.season_id == season_id)

        # ratio: same semantics as the alliance service (assists never move it)
        ratio_kos = total_kos + NOT_FOUGHT_KOS * total_not_fought
        ratio_fights = total_fights + total_not_fought
        ratio_expr = cast(
            func.coalesce((1 - ratio_kos / func.nullif(ratio_fights, 0)) * 100, 100),
            Integer,
        )

        # --- card: attacker aggregates ---
        card_row = (
            (
                await session.exec(
                    select(
                        cast(total_kos, Integer).label("total_kos"),
                        cast(total_not_fought, Integer).label("total_not_fought"),
                        cast(total_fights, Float).label("total_fights"),
                        ratio_expr.label("ratio"),
                    )
                    .select_from(WarDefensePlacement)
                    .join(War, WarDefensePlacement.war_id == War.id)
                    .join(
                        ChampionUser,
                        ChampionUser.id == WarDefensePlacement.attacker_champion_user_id,
                    )
                    .where(and_(*attacker_conds))
                )
            )
            .mappings()
            .first()
        )

        # --- participation: distinct wars attacked OR assisted ---
        war_pairs = union(
            select(War.id.label("war_id"))
            .join(WarDefensePlacement, WarDefensePlacement.war_id == War.id)
            .join(
                ChampionUser,
                ChampionUser.id == WarDefensePlacement.attacker_champion_user_id,
            )
            .where(and_(*attacker_conds)),
            select(War.id.label("war_id"))
            .join(WarDefensePlacement, WarDefensePlacement.war_id == War.id)
            .join(
                ChampionUser,
                ChampionUser.id == WarDefensePlacement.assist_champion_user_id,
            )
            .where(and_(*assist_conds)),
        ).subquery()

        # Single-column count() selects are auto-scalarized by SQLModel exec,
        # so read them with .one() (returns the scalar), not .mappings().
        wars_participated = (await session.exec(select(func.count()).select_from(war_pairs))).one()

        total_assists = (
            await session.exec(
                select(func.count(WarDefensePlacement.id))
                .select_from(WarDefensePlacement)
                .join(War, WarDefensePlacement.war_id == War.id)
                .join(
                    ChampionUser,
                    ChampionUser.id == WarDefensePlacement.assist_champion_user_id,
                )
                .where(and_(*assist_conds))
            )
        ).one()

        card = PlayerStatsCardResponse(
            ratio=(card_row["ratio"] if card_row and card_row["ratio"] is not None else 100),
            total_kos=(card_row["total_kos"] or 0) if card_row else 0,
            total_not_fought=(card_row["total_not_fought"] or 0) if card_row else 0,
            total_fights=(card_row["total_fights"] or 0.0) if card_row else 0.0,
            total_assists=total_assists or 0,
            wars_participated=wars_participated or 0,
        )

        # --- evolution: attacker-based, by war (season given) or by season (all) ---
        # War mode orders chronologically (min created_at per war) so the timeline
        # reads left-to-right by when each war happened, not alphabetically by
        # opponent. Season mode is already chronological by ascending number.
        if season_id is not None:
            label_col = War.opponent_name
            group_cols = [War.id, War.opponent_name]
            order_col = func.min(War.created_at)
        else:
            label_col = Season.number
            group_cols = [Season.id, Season.number]
            order_col = Season.number

        evo_rows = (
            (
                await session.exec(
                    select(
                        label_col.label("label"),
                        ratio_expr.label("ratio"),
                        cast(total_fights, Float).label("fights"),
                    )
                    .select_from(WarDefensePlacement)
                    .join(War, WarDefensePlacement.war_id == War.id)
                    .join(
                        ChampionUser,
                        ChampionUser.id == WarDefensePlacement.attacker_champion_user_id,
                    )
                    .join(Season, Season.id == War.season_id)
                    .where(and_(*attacker_conds))
                    .group_by(*group_cols)
                    .order_by(order_col.asc())
                )
            )
            .mappings()
            .all()
        )
        evolution = [
            RatioEvolutionPoint(
                label=(str(r["label"]) if season_id is not None else f"S{r['label']}"),
                ratio=r["ratio"] if r["ratio"] is not None else 100,
                fights=r["fights"] or 0.0,
            )
            for r in evo_rows
        ]

        # --- alliances played (assist-inclusive, from participated wars) ---
        alli_rows = (
            (
                await session.exec(
                    select(Alliance.name, Alliance.tag)
                    .select_from(war_pairs)
                    .join(War, War.id == war_pairs.c.war_id)
                    .join(Alliance, Alliance.id == War.alliance_id)
                    .group_by(Alliance.name, Alliance.tag)
                )
            )
            .mappings()
            .all()
        )
        alliances = [PlayerSeasonAllianceResponse(name=r["name"], tag=r["tag"]) for r in alli_rows]

        return PlayerStatsResponse(card=card, evolution=evolution, alliances=alliances)

    @classmethod
    async def get_player_champion_usage(
        cls,
        session: SessionDep,
        current_user: User,
        game_account_id: uuid.UUID,
        season_id: Optional[uuid.UUID] = None,
        deathless: Optional[bool] = None,
        perspective: str = "attacker",
    ) -> list[ChampionUsageResponse]:
        """Champion usage for one game account, from its war fight records.

        Scoped by `game_account_id` (cross-alliance). `perspective='attacker'`
        aggregates the champions the account used; `'defender'` the champions it
        faced. `season_id=None` aggregates across all seasons.
        """
        await cls.assert_can_view_account(session, current_user, game_account_id)

        conditions = [WarFightRecord.game_account_id == game_account_id]
        if season_id is not None:
            conditions.append(WarFightRecord.season_id == season_id)
        if deathless is True:
            conditions.append(WarFightRecord.ko_count == 0)

        if perspective == "defender":
            champion_id_col = WarFightRecord.defender_champion_id.label("champion_id")
            champion_join = Champion.id == WarFightRecord.defender_champion_id
            group_by_col = WarFightRecord.defender_champion_id
        else:
            champion_id_col = WarFightRecord.champion_id
            champion_join = Champion.id == WarFightRecord.champion_id
            group_by_col = WarFightRecord.champion_id

        stmt = (
            select(
                champion_id_col,
                Champion.name.label("champion_name"),
                Champion.image_url,
                cast(func.count(WarFightRecord.id), Integer).label("fight_count"),
                cast(func.sum(WarFightRecord.ko_count), Integer).label("total_kos"),
            )
            .join(Champion, champion_join)
            .where(and_(*conditions))
            .group_by(group_by_col, Champion.name, Champion.image_url)
            .order_by(func.count(WarFightRecord.id).desc())
        )
        rows = (await session.exec(stmt)).mappings().all()
        return [ChampionUsageResponse.model_validate(dict(r)) for r in rows]

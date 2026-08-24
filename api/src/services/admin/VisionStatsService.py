"""Aggregates over the AI (vision) roster imports, for the admin dashboard.

Everything here is read-only and admin-scoped. The three public entry points
mirror the three questions the dashboard asks — volume over time, who is
importing, and what the last imports look like — and they deliberately share
the same `days` window semantics so the numbers on one screen never disagree.

`days=0` means "all time"; any other value is a rolling window of whole UTC
days ending today. Whole days rather than a raw `now - N days` cutoff because
the daily chart buckets by calendar day, and a partial first bucket makes the
first bar of every chart look like a drop.
"""

import uuid
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import Integer, cast, desc, func
from sqlmodel import case, col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.dto.admin.dto_vision_stats import (
    PaginatedVisionImports,
    PaginatedVisionUserStats,
    VisionImportRow,
    VisionJobErrorStat,
    VisionStatsDailyPoint,
    VisionStatsOverview,
    VisionStatsResponse,
    VisionUserStat,
)
from src.models.Base import utcnow
from src.models.GameAccount import GameAccount
from src.models.User import User
from src.models.VisionImport import VisionImport, VisionImportStatus
from src.models.VisionJob import VisionJob, VisionJobStatus
from src.models.VisionPrediction import VisionPrediction

# The leaderboard columns an admin may sort on. A whitelist rather than a
# free-form column name: the value lands in an ORDER BY.
USER_SORT_COLUMNS = (
    "imports_total",
    "imports_confirmed",
    "imports_cancelled",
    "imports_failed",
    "screens_total",
    "last_import_at",
)

TOP_ERRORS_LIMIT = 5

_FINISHED_STATUSES = (
    VisionImportStatus.CONFIRMED,
    VisionImportStatus.CANCELLED,
    VisionImportStatus.FAILED,
)


def _ratio(numerator: int, denominator: int) -> float:
    """Rounded 0..1 ratio, 0.0 when there is nothing to divide by."""
    if not denominator:
        return 0.0
    return round(numerator / denominator, 4)


def _as_date(value: date | datetime | str) -> date:
    """Normalise what the DB returned for `DATE(created_at)`.

    MariaDB hands back a `date`, SQLite a `'YYYY-MM-DD'` string. Both are
    correct; only the Python type differs, and the DTO wants one of them.
    """
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    return date.fromisoformat(str(value)[:10])


class VisionStatsService:
    @staticmethod
    def window_start(days: int) -> datetime | None:
        """Midnight UTC of the first day in the window, or None for all time."""
        if days <= 0:
            return None
        today = utcnow().astimezone(UTC).date()
        return datetime.combine(today - timedelta(days=days - 1), datetime.min.time(), tzinfo=UTC)

    @classmethod
    def _since(cls, column, days: int):
        """The window predicate for `column`, or an always-true one for all time."""
        start = cls.window_start(days)
        if start is None:
            return True
        return column >= start

    # ── Overview ────────────────────────────────────────────────────────

    @classmethod
    async def _import_counters(cls, session: AsyncSession, days: int) -> dict:
        rows = (
            await session.execute(
                select(
                    col(VisionImport.status),
                    func.count(col(VisionImport.id)),
                    func.coalesce(func.sum(col(VisionImport.screens_total)), 0),
                    func.coalesce(
                        func.sum(
                            cast(case((col(VisionImport.share_dataset), 1), else_=0), Integer)
                        ),
                        0,
                    ),
                )
                .where(cls._since(col(VisionImport.created_at), days))
                .group_by(col(VisionImport.status))
            )
        ).all()

        per_status = {status: count for status, count, _, _ in rows}
        return {
            "per_status": per_status,
            "imports_total": sum(per_status.values()),
            "screens_total": sum(int(screens) for _, _, screens, _ in rows),
            "shared_dataset_imports": sum(int(shared) for *_, shared in rows),
        }

    @classmethod
    async def _job_counters(cls, session: AsyncSession, days: int) -> tuple[int, int]:
        rows = (
            await session.execute(
                select(col(VisionJob.status), func.count(col(VisionJob.id)))
                .where(cls._since(col(VisionJob.created_at), days))
                .group_by(col(VisionJob.status))
            )
        ).all()
        total = sum(count for _, count in rows)
        failed = sum(count for status, count in rows if status == VisionJobStatus.FAILED)
        return total, failed

    @classmethod
    async def _prediction_counters(
        cls, session: AsyncSession, days: int
    ) -> tuple[int, int, int, float | None]:
        row = (
            await session.execute(
                select(
                    func.count(col(VisionPrediction.id)),
                    func.coalesce(
                        func.sum(
                            cast(
                                case((col(VisionPrediction.champion_name).is_(None), 1), else_=0),
                                Integer,
                            )
                        ),
                        0,
                    ),
                    func.coalesce(
                        func.sum(cast(case((col(VisionPrediction.reranked), 1), else_=0), Integer)),
                        0,
                    ),
                    func.avg(col(VisionPrediction.confidence)),
                )
                .select_from(VisionPrediction)
                .join(VisionJob, col(VisionJob.id) == col(VisionPrediction.job_id))
                .where(cls._since(col(VisionJob.created_at), days))
            )
        ).one()
        total, unidentified, reranked, avg_confidence = row
        return (
            int(total),
            int(unidentified),
            int(reranked),
            round(float(avg_confidence), 4) if avg_confidence is not None else None,
        )

    @classmethod
    async def _distinct_actors(cls, session: AsyncSession, days: int) -> tuple[int, int]:
        row = (
            await session.execute(
                select(
                    func.count(func.distinct(col(GameAccount.user_id))),
                    func.count(func.distinct(col(VisionImport.game_account_id))),
                )
                .select_from(VisionImport)
                .join(GameAccount, col(GameAccount.id) == col(VisionImport.game_account_id))
                .where(cls._since(col(VisionImport.created_at), days))
            )
        ).one()
        return int(row[0]), int(row[1])

    @classmethod
    async def _daily(cls, session: AsyncSession, days: int) -> list[VisionStatsDailyPoint]:
        day_col = func.date(col(VisionImport.created_at))
        rows = (
            await session.execute(
                select(
                    day_col,
                    func.count(col(VisionImport.id)),
                    func.coalesce(func.sum(col(VisionImport.screens_total)), 0),
                    func.coalesce(
                        func.sum(
                            cast(
                                case(
                                    (
                                        col(VisionImport.status) == VisionImportStatus.CONFIRMED,
                                        1,
                                    ),
                                    else_=0,
                                ),
                                Integer,
                            )
                        ),
                        0,
                    ),
                )
                .where(cls._since(col(VisionImport.created_at), days))
                .group_by(day_col)
                .order_by(day_col)
            )
        ).all()

        by_day = {
            _as_date(day): VisionStatsDailyPoint(
                day=_as_date(day),
                imports=int(imports),
                screens=int(screens),
                confirmed=int(confirmed),
            )
            for day, imports, screens, confirmed in rows
        }
        if days <= 0:
            # All-time: no zero-filling. A gap of months between two imports is
            # information, not a hole the chart has to draw one bar per day for.
            return [by_day[day] for day in sorted(by_day)]

        today = utcnow().astimezone(UTC).date()
        span = [today - timedelta(days=offset) for offset in reversed(range(days))]
        return [by_day.get(day, VisionStatsDailyPoint(day=day)) for day in span]

    @classmethod
    async def _top_errors(cls, session: AsyncSession, days: int) -> list[VisionJobErrorStat]:
        count = func.count(col(VisionJob.id))
        rows = (
            await session.execute(
                select(col(VisionJob.error), count)
                .where(
                    col(VisionJob.status) == VisionJobStatus.FAILED,
                    col(VisionJob.error).is_not(None),
                    cls._since(col(VisionJob.created_at), days),
                )
                .group_by(col(VisionJob.error))
                .order_by(desc(count))
                .limit(TOP_ERRORS_LIMIT)
            )
        ).all()
        return [VisionJobErrorStat(error=error, count=int(total)) for error, total in rows]

    @classmethod
    async def get_stats(cls, session: AsyncSession, days: int) -> VisionStatsResponse:
        counters = await cls._import_counters(session, days)
        per_status = counters["per_status"]
        imports_total = counters["imports_total"]

        jobs_total, jobs_failed = await cls._job_counters(session, days)
        predictions, unidentified, reranked, avg_confidence = await cls._prediction_counters(
            session, days
        )
        distinct_users, distinct_accounts = await cls._distinct_actors(session, days)
        imports_all_time = (
            await session.execute(select(func.count(col(VisionImport.id))))
        ).scalar_one()

        confirmed = per_status.get(VisionImportStatus.CONFIRMED, 0)
        cancelled = per_status.get(VisionImportStatus.CANCELLED, 0)
        failed = per_status.get(VisionImportStatus.FAILED, 0)
        finished = sum(per_status.get(status, 0) for status in _FINISHED_STATUSES)

        overview = VisionStatsOverview(
            imports_total=imports_total,
            imports_confirmed=confirmed,
            imports_cancelled=cancelled,
            imports_failed=failed,
            imports_in_progress=imports_total - finished,
            imports_all_time=int(imports_all_time),
            screens_total=counters["screens_total"],
            jobs_total=jobs_total,
            jobs_failed=jobs_failed,
            predictions_total=predictions,
            distinct_users=distinct_users,
            distinct_game_accounts=distinct_accounts,
            shared_dataset_imports=counters["shared_dataset_imports"],
            avg_confidence=avg_confidence,
            unidentified_predictions=unidentified,
            reranked_predictions=reranked,
            # Denominator is finished imports: an import still running has not
            # yet had the chance to be confirmed, and counting it as a miss
            # makes the rate sag every time someone starts a batch.
            confirm_rate=_ratio(confirmed, finished),
            job_failure_rate=_ratio(jobs_failed, jobs_total),
            avg_screens_per_import=round(counters["screens_total"] / imports_total, 2)
            if imports_total
            else 0.0,
        )

        return VisionStatsResponse(
            days=days,
            overview=overview,
            daily=await cls._daily(session, days),
            top_errors=await cls._top_errors(session, days),
        )

    # ── Per-user leaderboard ────────────────────────────────────────────

    @classmethod
    async def _pseudos_by_user(
        cls, session: AsyncSession, user_ids: list[uuid.UUID]
    ) -> dict[uuid.UUID, list[str]]:
        """Game pseudos per user, for the page being rendered only.

        Resolved separately rather than aggregated into the leaderboard query:
        a user with three game accounts would otherwise fan the join out and
        triple every SUM in it.
        """
        if not user_ids:
            return {}
        rows = (
            await session.execute(
                select(col(GameAccount.user_id), col(GameAccount.game_pseudo))
                .where(col(GameAccount.user_id).in_(user_ids))
                .order_by(col(GameAccount.game_pseudo))
            )
        ).all()
        pseudos: dict[uuid.UUID, list[str]] = {}
        for user_id, pseudo in rows:
            pseudos.setdefault(user_id, []).append(pseudo)
        return pseudos

    @classmethod
    async def _predictions_by_user(
        cls, session: AsyncSession, days: int, user_ids: list[uuid.UUID]
    ) -> dict[uuid.UUID, int]:
        if not user_ids:
            return {}
        rows = (
            await session.execute(
                select(col(GameAccount.user_id), func.count(col(VisionPrediction.id)))
                .select_from(VisionPrediction)
                .join(VisionJob, col(VisionJob.id) == col(VisionPrediction.job_id))
                .join(VisionImport, col(VisionImport.id) == col(VisionJob.import_id))
                .join(GameAccount, col(GameAccount.id) == col(VisionImport.game_account_id))
                .where(
                    col(GameAccount.user_id).in_(user_ids),
                    cls._since(col(VisionImport.created_at), days),
                )
                .group_by(col(GameAccount.user_id))
            )
        ).all()
        return {user_id: int(total) for user_id, total in rows}

    @classmethod
    async def get_user_stats(
        cls,
        session: AsyncSession,
        days: int,
        page: int = 1,
        size: int = 20,
        sort_by: str = "imports_total",
        sort_order: str = "desc",
    ) -> PaginatedVisionUserStats:
        if sort_by not in USER_SORT_COLUMNS:
            sort_by = "imports_total"

        def status_sum(status: VisionImportStatus):
            return func.coalesce(
                func.sum(cast(case((col(VisionImport.status) == status, 1), else_=0), Integer)), 0
            )

        aggregates = {
            "imports_total": func.count(col(VisionImport.id)),
            "imports_confirmed": status_sum(VisionImportStatus.CONFIRMED),
            "imports_cancelled": status_sum(VisionImportStatus.CANCELLED),
            "imports_failed": status_sum(VisionImportStatus.FAILED),
            "screens_total": func.coalesce(func.sum(col(VisionImport.screens_total)), 0),
            "last_import_at": func.max(col(VisionImport.created_at)),
        }
        shared_sum = func.coalesce(
            func.sum(cast(case((col(VisionImport.share_dataset), 1), else_=0), Integer)), 0
        )

        base = (
            select(
                col(User.id),
                col(User.login),
                col(User.role),
                aggregates["imports_total"].label("imports_total"),
                aggregates["imports_confirmed"].label("imports_confirmed"),
                aggregates["imports_cancelled"].label("imports_cancelled"),
                aggregates["imports_failed"].label("imports_failed"),
                aggregates["screens_total"].label("screens_total"),
                shared_sum.label("shared_dataset_imports"),
                func.min(col(VisionImport.created_at)).label("first_import_at"),
                aggregates["last_import_at"].label("last_import_at"),
            )
            .select_from(VisionImport)
            .join(GameAccount, col(GameAccount.id) == col(VisionImport.game_account_id))
            .join(User, col(User.id) == col(GameAccount.user_id))
            .where(cls._since(col(VisionImport.created_at), days))
            .group_by(col(User.id), col(User.login), col(User.role))
        )

        total = (
            await session.execute(select(func.count()).select_from(base.order_by(None).subquery()))
        ).scalar_one()

        order = aggregates[sort_by]
        ordered = base.order_by(
            order.asc() if sort_order == "asc" else desc(order), col(User.login)
        )
        rows = (await session.execute(ordered.offset((page - 1) * size).limit(size))).all()

        user_ids = [row[0] for row in rows]
        pseudos = await cls._pseudos_by_user(session, user_ids)
        predictions = await cls._predictions_by_user(session, days, user_ids)

        items = [
            VisionUserStat(
                user_id=row.id,
                login=row.login,
                role=str(getattr(row.role, "value", row.role)),
                game_pseudos=pseudos.get(row.id, []),
                imports_total=int(row.imports_total),
                imports_confirmed=int(row.imports_confirmed),
                imports_cancelled=int(row.imports_cancelled),
                imports_failed=int(row.imports_failed),
                screens_total=int(row.screens_total),
                predictions_total=predictions.get(row.id, 0),
                shared_dataset_imports=int(row.shared_dataset_imports),
                confirm_rate=_ratio(int(row.imports_confirmed), int(row.imports_total)),
                first_import_at=row.first_import_at,
                last_import_at=row.last_import_at,
            )
            for row in rows
        ]

        return PaginatedVisionUserStats(
            items=items,
            total=int(total),
            page=page,
            size=size,
            pages=(int(total) + size - 1) // size if size else 0,
        )

    # ── Recent imports ──────────────────────────────────────────────────

    @classmethod
    async def _job_rollup(
        cls, session: AsyncSession, import_ids: list[uuid.UUID]
    ) -> dict[uuid.UUID, tuple[int, int]]:
        """(failed jobs, predictions) per import, for the page being rendered."""
        if not import_ids:
            return {}
        failed_rows = (
            await session.execute(
                select(col(VisionJob.import_id), func.count(col(VisionJob.id)))
                .where(
                    col(VisionJob.import_id).in_(import_ids),
                    col(VisionJob.status) == VisionJobStatus.FAILED,
                )
                .group_by(col(VisionJob.import_id))
            )
        ).all()
        prediction_rows = (
            await session.execute(
                select(col(VisionJob.import_id), func.count(col(VisionPrediction.id)))
                .select_from(VisionJob)
                .join(VisionPrediction, col(VisionPrediction.job_id) == col(VisionJob.id))
                .where(col(VisionJob.import_id).in_(import_ids))
                .group_by(col(VisionJob.import_id))
            )
        ).all()
        failed = {import_id: int(count) for import_id, count in failed_rows}
        predictions = {import_id: int(count) for import_id, count in prediction_rows}
        return {
            import_id: (failed.get(import_id, 0), predictions.get(import_id, 0))
            for import_id in import_ids
        }

    @classmethod
    async def get_recent_imports(
        cls,
        session: AsyncSession,
        days: int,
        page: int = 1,
        size: int = 20,
        status: VisionImportStatus | None = None,
        user_id: uuid.UUID | None = None,
    ) -> PaginatedVisionImports:
        filters = [cls._since(col(VisionImport.created_at), days)]
        if status is not None:
            filters.append(col(VisionImport.status) == status)
        if user_id is not None:
            filters.append(col(GameAccount.user_id) == user_id)

        base = (
            select(VisionImport, GameAccount, User)
            .join(GameAccount, col(GameAccount.id) == col(VisionImport.game_account_id))
            .join(User, col(User.id) == col(GameAccount.user_id))
            .where(*filters)
        )

        total = (
            await session.execute(
                select(func.count())
                .select_from(VisionImport)
                .join(GameAccount, col(GameAccount.id) == col(VisionImport.game_account_id))
                .where(*filters)
            )
        ).scalar_one()

        rows = (
            await session.execute(
                base.order_by(desc(col(VisionImport.created_at)))
                .offset((page - 1) * size)
                .limit(size)
            )
        ).all()

        rollup = await cls._job_rollup(session, [row[0].id for row in rows])
        items = [
            VisionImportRow(
                id=vision_import.id,
                created_at=vision_import.created_at,
                status=vision_import.status.value,
                user_id=user.id,
                login=user.login,
                game_account_id=game_account.id,
                game_pseudo=game_account.game_pseudo,
                screens_total=vision_import.screens_total,
                screens_done=vision_import.screens_done,
                jobs_failed=rollup.get(vision_import.id, (0, 0))[0],
                predictions_total=rollup.get(vision_import.id, (0, 0))[1],
                share_dataset=vision_import.share_dataset,
            )
            for vision_import, game_account, user in rows
        ]

        return PaginatedVisionImports(
            items=items,
            total=int(total),
            page=page,
            size=size,
            pages=(int(total) + size - 1) // size if size else 0,
        )

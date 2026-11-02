"""Login activity aggregates for the admin Logins tab.

Buckets are computed in Python rather than SQL: converting to a time zone
needs MariaDB's zone tables, which SQLite (the test engine) does not have.
The window follows `VisionStatsService.window_start`, so both admin tabs
agree on what "last 30 days" means.
"""

import uuid
from collections import defaultdict
from collections.abc import Callable
from datetime import UTC, date, datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import HTTPException
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.dto.admin.dto_login_stats import (
    LoginHourStat,
    LoginMonthStat,
    LoginStatsResponse,
    LoginWeekdayStat,
)
from src.enums.LoginEventKind import LoginEventKind
from src.models.Base import utcnow
from src.models.user.LoginLog import LoginLog
from src.services.admin.VisionStatsService import VisionStatsService

Event = tuple[uuid.UUID, datetime, LoginEventKind]


def _local(at: datetime, zone: ZoneInfo) -> datetime:
    # SQLite returns naive datetimes; they were written as UTC.
    if at.tzinfo is None:
        at = at.replace(tzinfo=UTC)
    return at.astimezone(zone)


def _bucket(events: list[Event]) -> dict:
    """The counters of one bucket, as keyword arguments for a `LoginBucket`."""
    logins = sum(1 for _, _, kind in events if kind == LoginEventKind.LOGIN)
    return {
        "accounts": len({user_id for user_id, _, _ in events}),
        "events": len(events),
        "logins": logins,
        "refreshes": len(events) - logins,
    }


def _tally(events: list[Event], key: Callable[[datetime], object]) -> dict[object, dict]:
    grouped: dict[object, list[Event]] = defaultdict(list)
    for event in events:
        grouped[key(event[1])].append(event)
    return {bucket_key: _bucket(group) for bucket_key, group in grouped.items()}


class LoginStatsService:
    @staticmethod
    def zone_for(name: str) -> ZoneInfo:
        try:
            return ZoneInfo(name)
        except (ZoneInfoNotFoundError, ValueError) as error:
            raise HTTPException(status_code=422, detail=f"Unknown time zone: {name}") from error

    @staticmethod
    def month_keys(first: date, last: date) -> list[str]:
        """Every "YYYY-MM" from the month of `first` through the month of `last`, inclusive."""
        keys: list[str] = []
        year, month = first.year, first.month
        while (year, month) <= (last.year, last.month):
            keys.append(f"{year:04d}-{month:02d}")
            year, month = (year + 1, 1) if month == 12 else (year, month + 1)
        return keys

    @classmethod
    async def get_stats(
        cls,
        session: AsyncSession,
        days: int,
        tz: str,
        kind: LoginEventKind | None = None,
    ) -> LoginStatsResponse:
        zone = cls.zone_for(tz)
        start = VisionStatsService.window_start(days)
        filters = []
        if start is not None:
            filters.append(col(LoginLog.date_connexion) >= start)
        if kind is not None:
            filters.append(col(LoginLog.kind) == kind)

        rows = (
            await session.exec(
                select(
                    col(LoginLog.user_id), col(LoginLog.date_connexion), col(LoginLog.kind)
                ).where(*filters)
            )
        ).all()
        events: list[Event] = [(user_id, _local(at, zone), kind) for user_id, at, kind in rows]

        by_month = _tally(events, lambda at: f"{at:%Y-%m}")
        by_weekday = _tally(events, lambda at: at.weekday())
        by_hour = _tally(events, lambda at: at.hour)
        empty = _bucket([])

        if start is not None:
            first: datetime | None = start.astimezone(zone)
        elif events:
            first = min(at for _, at, _ in events)
        else:
            first = None
        months: list[LoginMonthStat] = []
        if first is not None:
            last = max([utcnow().astimezone(zone), *(at for _, at, _ in events)])
            months = [
                LoginMonthStat(month=key, **by_month.get(key, empty))
                for key in cls.month_keys(first, last)
            ]

        totals = _bucket(events)
        return LoginStatsResponse(
            total_accounts=totals["accounts"],
            total_events=totals["events"],
            total_logins=totals["logins"],
            total_refreshes=totals["refreshes"],
            by_month=months,
            by_weekday=[
                LoginWeekdayStat(weekday=day, **by_weekday.get(day, empty)) for day in range(7)
            ],
            by_hour=[LoginHourStat(hour=hour, **by_hour.get(hour, empty)) for hour in range(24)],
        )

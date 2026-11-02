"""Login activity aggregates for the admin Logins tab.

Buckets are computed in Python rather than SQL: converting to a time zone
needs MariaDB's zone tables, which SQLite (the test engine) does not have.
The window follows `VisionStatsService.window_start`, so both admin tabs
agree on what "last 30 days" means.
"""

import uuid
from collections import Counter, defaultdict
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

Tally = dict[object, tuple[int, int]]


def _local(at: datetime, zone: ZoneInfo) -> datetime:
    # SQLite returns naive datetimes; they were written as UTC.
    if at.tzinfo is None:
        at = at.replace(tzinfo=UTC)
    return at.astimezone(zone)


def _tally(keyed: list[tuple[object, uuid.UUID]]) -> Tally:
    """(distinct accounts, row count) per bucket key."""
    users: dict[object, set[uuid.UUID]] = defaultdict(set)
    events: Counter[object] = Counter()
    for key, user_id in keyed:
        users[key].add(user_id)
        events[key] += 1
    return {key: (len(users[key]), events[key]) for key in events}


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
                select(col(LoginLog.user_id), col(LoginLog.date_connexion)).where(*filters)
            )
        ).all()
        events = [(user_id, _local(at, zone)) for user_id, at in rows]

        by_month = _tally([(f"{at:%Y-%m}", user_id) for user_id, at in events])
        by_weekday = _tally([(at.weekday(), user_id) for user_id, at in events])
        by_hour = _tally([(at.hour, user_id) for user_id, at in events])

        if start is not None:
            first: datetime | None = start.astimezone(zone)
        elif events:
            first = min(at for _, at in events)
        else:
            first = None
        months: list[LoginMonthStat] = []
        if first is not None:
            last = max([utcnow().astimezone(zone), *(at for _, at in events)])
            months = [
                LoginMonthStat(month=key, accounts=accounts, events=count)
                for key in cls.month_keys(first, last)
                for accounts, count in [by_month.get(key, (0, 0))]
            ]

        return LoginStatsResponse(
            total_accounts=len({user_id for user_id, _ in events}),
            total_events=len(events),
            by_month=months,
            by_weekday=[
                LoginWeekdayStat(weekday=day, accounts=accounts, events=count)
                for day in range(7)
                for accounts, count in [by_weekday.get(day, (0, 0))]
            ],
            by_hour=[
                LoginHourStat(hour=hour, accounts=accounts, events=count)
                for hour in range(24)
                for accounts, count in [by_hour.get(hour, (0, 0))]
            ],
        )

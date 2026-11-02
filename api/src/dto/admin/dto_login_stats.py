"""Admin-side aggregates over Login events (OAuth sign-ins and token refreshes).

Every bucket carries two numbers: `accounts` (distinct Accounts) and `events`
(rows). They are kept apart because one Account signing in five times is one
Account in the reach figure and five in the activity figure.
"""

from pydantic import BaseModel


class LoginBucket(BaseModel):
    accounts: int = 0
    events: int = 0


class LoginMonthStat(LoginBucket):
    month: str


class LoginWeekdayStat(LoginBucket):
    # 0 = Monday, 6 = Sunday.
    weekday: int


class LoginHourStat(LoginBucket):
    hour: int


class LoginStatsResponse(BaseModel):
    total_accounts: int = 0
    total_events: int = 0
    by_month: list[LoginMonthStat]
    by_weekday: list[LoginWeekdayStat]
    by_hour: list[LoginHourStat]

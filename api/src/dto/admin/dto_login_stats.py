"""Admin-side aggregates over Login events (OAuth sign-ins and token refreshes).

Every bucket carries `accounts` (distinct Accounts) and `events` (rows), the
latter split into `logins` (OAuth sign-ins) and `refreshes`. One Account signing
in five times is one Account in the reach figure and five in the activity figure.
"""

from pydantic import BaseModel


class LoginBucket(BaseModel):
    accounts: int = 0
    events: int = 0
    logins: int = 0
    refreshes: int = 0


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
    total_logins: int = 0
    total_refreshes: int = 0
    by_month: list[LoginMonthStat]
    by_weekday: list[LoginWeekdayStat]
    by_hour: list[LoginHourStat]

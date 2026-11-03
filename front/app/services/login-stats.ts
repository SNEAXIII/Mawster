// ─── Admin login activity service ────────────────────────
import { api } from '@/app/services/utils'

export interface LoginBucket {
  accounts: number
  events: number
  logins: number
  refreshes: number
}

export interface LoginMonthStat extends LoginBucket {
  month: string
}

export interface LoginWeekdayStat extends LoginBucket {
  /** 0 = Monday, 6 = Sunday. */
  weekday: number
}

export interface LoginHourStat extends LoginBucket {
  hour: number
}

export interface LoginStats {
  total_accounts: number
  total_events: number
  total_logins: number
  total_refreshes: number
  by_month: LoginMonthStat[]
  by_weekday: LoginWeekdayStat[]
  by_hour: LoginHourStat[]
}

export async function getLoginStats(params: { days: number; tz: string }): Promise<LoginStats> {
  const query = new URLSearchParams({ days: String(params.days), tz: params.tz })
  return api(`/admin/logins/stats?${query}`, 'Failed to load login activity')
}

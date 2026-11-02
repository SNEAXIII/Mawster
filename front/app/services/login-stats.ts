// ─── Admin login activity service ────────────────────────
import { api } from '@/app/services/utils'

export const LOGIN_EVENT_KINDS = ['login', 'refresh'] as const
export type LoginEventKind = (typeof LOGIN_EVENT_KINDS)[number]

export interface LoginBucket {
  accounts: number
  events: number
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
  by_month: LoginMonthStat[]
  by_weekday: LoginWeekdayStat[]
  by_hour: LoginHourStat[]
}

export async function getLoginStats(params: {
  days: number
  tz: string
  kind?: LoginEventKind
}): Promise<LoginStats> {
  const query = new URLSearchParams({ days: String(params.days), tz: params.tz })
  if (params.kind) query.set('kind', params.kind)
  return api(`/admin/logins/stats?${query}`, 'Failed to load login activity')
}

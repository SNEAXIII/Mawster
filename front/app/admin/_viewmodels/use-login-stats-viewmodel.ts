'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { isOneOf } from '@/app/lib/utils'
import { ALL_TIME_DAYS } from '@/app/services/vision-stats'
import {
  getLoginStats,
  LOGIN_EVENT_KINDS,
  type LoginEventKind,
  type LoginStats,
} from '@/app/services/login-stats'

export const LOGIN_PERIOD_OPTIONS = [30, 90, 365, ALL_TIME_DAYS] as const
export const DEFAULT_LOGIN_PERIOD = 365

/** Loads the login activity; period and kind are shared by the three charts. */
export function useLoginStatsViewModel() {
  const [days, setDays] = useState<number>(DEFAULT_LOGIN_PERIOD)
  const [kind, setKind] = useState<LoginEventKind | ''>('')
  const [stats, setStats] = useState<LoginStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(false)
  // Only the latest request may write state: a slow all-time query must not overwrite a newer period.
  const requestId = useRef(0)

  const load = useCallback(async () => {
    const id = ++requestId.current
    setRefreshing(true)
    setError(false)
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
      const next = await getLoginStats({ days, tz, kind: kind || undefined })
      if (id === requestId.current) setStats(next)
    } catch {
      if (id === requestId.current) setError(true)
    } finally {
      if (id === requestId.current) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [days, kind])

  useEffect(() => {
    void load()
  }, [load])

  const changePeriod = (value: string) => {
    if (isOneOf(LOGIN_PERIOD_OPTIONS.map(String), value)) setDays(Number(value))
  }

  const changeKind = (value: string) => {
    setKind(isOneOf(LOGIN_EVENT_KINDS, value) ? value : '')
  }

  return { days, changePeriod, kind, changeKind, stats, loading, refreshing, error, reload: load }
}

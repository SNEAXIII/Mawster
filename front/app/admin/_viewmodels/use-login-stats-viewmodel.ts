'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { isOneOf } from '@/app/lib/utils'
import { ALL_TIME_DAYS } from '@/app/services/vision-stats'
import { getLoginStats, type LoginStats } from '@/app/services/login-stats'

export const LOGIN_PERIOD_OPTIONS = [30, 90, 365, ALL_TIME_DAYS] as const
export const DEFAULT_LOGIN_PERIOD = 365

/** Loads the login activity; the period is shared by the three charts. */
export function useLoginStatsViewModel() {
  const [days, setDays] = useState<number>(DEFAULT_LOGIN_PERIOD)
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
      const next = await getLoginStats({ days, tz })
      if (id === requestId.current) setStats(next)
    } catch {
      if (id === requestId.current) setError(true)
    } finally {
      if (id === requestId.current) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [days])

  useEffect(() => {
    void load()
  }, [load])

  const changePeriod = (value: string) => {
    if (isOneOf(LOGIN_PERIOD_OPTIONS.map(String), value)) setDays(Number(value))
  }

  return { days, changePeriod, stats, loading, refreshing, error, reload: load }
}

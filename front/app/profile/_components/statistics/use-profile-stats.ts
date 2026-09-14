'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useI18n } from '@/app/i18n'
import { useGameAccounts } from '@/app/contexts/game-accounts-context'
import {
  getPlayerSeasons,
  getPlayerStats,
  getPlayerChampionUsage,
  type PlayerStats,
  type PlayerSeasonOption,
} from '@/app/services/player-stats'
import { useChampionUsageChart } from '@/app/components/statistics/use-champion-usage-chart'

export function useProfileStats() {
  const { t } = useI18n()
  const hasStatsRef = useRef(false)
  const { accounts, loading: accountsLoading } = useGameAccounts()
  const [accountId, setAccountId] = useState('')
  const [seasons, setSeasons] = useState<PlayerSeasonOption[]>([])
  const [seasonId, setSeasonId] = useState<string | undefined>(undefined)
  const [stats, setStats] = useState<PlayerStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Default to the first account, and fall back when the selected one disappears.
  useEffect(() => {
    if (!accounts.some((a) => a.id === accountId)) setAccountId(accounts[0]?.id ?? '')
  }, [accounts, accountId])

  useEffect(() => {
    if (!accountId) return
    getPlayerSeasons(accountId)
      .then((s) => {
        setSeasons(s)
        setSeasonId(s[0]?.season_id)
      })
      .catch(() => {
        setSeasons([])
        setSeasonId(undefined)
      })
  }, [accountId])

  // Stats card + ratio evolution — reload only on account/season change.
  const loadStats = useCallback(async () => {
    if (!accountId) return
    setLoading(true)
    setError('')
    try {
      setStats(await getPlayerStats(accountId, seasonId))
      hasStatsRef.current = true
    } catch {
      setError('error')
      // Background refetch (stats already on screen): keep them, warn via toast.
      if (hasStatsRef.current) toast.error(t.profile.statistics.error)
    } finally {
      setLoading(false)
    }
  }, [accountId, seasonId, t])

  useEffect(() => {
    loadStats()
  }, [loadStats])

  // Champion usage pie — shared chart hook, refetches on its own chartLoading.
  const chart = useChampionUsageChart(
    (deathless, perspective) => getPlayerChampionUsage(accountId, seasonId, deathless, perspective),
    [accountId, seasonId],
    Boolean(accountId)
  )

  return {
    accounts,
    accountsLoading,
    accountId,
    setAccountId,
    seasons,
    seasonId,
    setSeasonId,
    stats,
    usage: chart.usage,
    metric: chart.metric,
    setMetric: chart.setMetric,
    perspective: chart.perspective,
    setPerspective: chart.setPerspective,
    detailOpen: chart.detailOpen,
    setDetailOpen: chart.setDetailOpen,
    loading,
    chartLoading: chart.chartLoading,
    error,
    retry: loadStats,
  }
}

'use client'

import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '@/app/i18n'
import {
  forceSnapshotWars,
  getSnapshotStats,
  type AllianceSnapshotStat,
} from '@/app/services/fight-records'

export function useSnapshotStatsViewModel() {
  const { t } = useI18n()
  const [stats, setStats] = useState<AllianceSnapshotStat[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshResult, setRefreshResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      setStats(await getSnapshotStats())
    } catch {
      setError(t.admin.knowledgeBase.loadError)
    }
  }, [t])

  useEffect(() => {
    load()
  }, [load])

  const handleRefresh = async () => {
    setLoading(true)
    setRefreshResult(null)
    setError(null)
    try {
      const result = await forceSnapshotWars()
      setRefreshResult(
        t.admin.knowledgeBase.refreshResult
          .replace('{{count}}', String(result.snapshotted))
          .replace('{{skipped}}', String(result.skipped))
      )
      await load()
    } catch {
      setError(t.admin.knowledgeBase.refreshError)
    } finally {
      setLoading(false)
    }
  }

  return { stats, loading, refreshResult, error, handleRefresh }
}

'use client'

import { useEffect, useState } from 'react'
import type { ChampionUsageItem } from '@/app/services/statistics'
import { Metric, Perspective } from '@/app/components/statistics/member-champion-chart'

/**
 * Shared champion-usage chart logic (profile + alliance).
 * Owns metric/perspective/detail state and refetches the pie chart on its own
 * `chartLoading` — so clicking a metric/perspective only reloads the chart,
 * never the surrounding stats block (no full "refresh").
 *
 * @param fetcher   fetches usage for the current deathless/perspective selection
 * @param deps      external inputs that should also trigger a refetch (ids, filters)
 * @param enabled   skip fetching until true (e.g. no account/alliance selected yet)
 */
export function useChampionUsageChart(
  fetcher: (deathless: boolean, perspective: Perspective) => Promise<ChampionUsageItem[]>,
  deps: readonly unknown[],
  enabled = true
) {
  const [usage, setUsage] = useState<ChampionUsageItem[]>([])
  const [metric, setMetric] = useState<Metric>('deathless')
  const [perspective, setPerspective] = useState<Perspective>('attacker')
  const [detailOpen, setDetailOpen] = useState(false)
  const [chartLoading, setChartLoading] = useState(false)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    setChartLoading(true)
    fetcher(metric === 'deathless', perspective)
      .then((u) => {
        if (!cancelled) setUsage(u)
      })
      .catch(() => {
        if (!cancelled) setUsage([])
      })
      .finally(() => {
        if (!cancelled) setChartLoading(false)
      })
    return () => {
      cancelled = true
    }
    // fetcher is re-created each render on purpose; refetch is driven by deps + selection
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, metric, perspective, ...deps])

  return {
    usage,
    metric,
    setMetric,
    perspective,
    setPerspective,
    detailOpen,
    setDetailOpen,
    chartLoading,
  }
}

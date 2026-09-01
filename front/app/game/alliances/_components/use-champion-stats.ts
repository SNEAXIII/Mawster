'use client'

import { useEffect, useMemo, useState } from 'react'
import { getChampionUsage } from '@/app/services/statistics'
import { getWars, type War } from '@/app/services/war'
import { useChampionUsageChart } from '@/app/components/statistics/use-champion-usage-chart'

// selectedWarId is owned by the alliances viewmodel: the war filter drives both
// the champion chart (here) and the season stats table (fetched upstream).
export function useChampionStats(
  allianceId: string,
  selectedGroup = 'all',
  selectedWarId: string | null = null,
  selectedSeasonId: string | null = null
) {
  const [selectedGameAccountId, setSelectedGameAccountId] = useState<string | null>(null)
  const [wars, setWars] = useState<War[]>([])

  useEffect(() => {
    if (!allianceId) return
    getWars(allianceId)
      .then((all) => setWars(all.filter((w) => w.season_id !== null && w.status === 'ended')))
      .catch(console.error)
  }, [allianceId])

  // Seasons come from the wars themselves: a season is offered iff the alliance
  // has at least one ended war in it, which is exactly what the stats count.
  const seasons = useMemo(() => {
    const bySeason = new Map<string, number>()
    for (const w of wars) {
      if (w.season_id !== null && w.season_number !== null)
        bySeason.set(w.season_id, w.season_number)
    }
    return Array.from(bySeason, ([id, number]) => ({ id, number })).sort(
      (a, b) => b.number - a.number
    )
  }, [wars])

  const seasonWars = useMemo(
    () => (selectedSeasonId === null ? wars : wars.filter((w) => w.season_id === selectedSeasonId)),
    [wars, selectedSeasonId]
  )

  const groupNum =
    selectedGroup !== 'all' && selectedGroup !== 'none' ? Number(selectedGroup) : undefined

  const chart = useChampionUsageChart(
    (deathless, perspective) =>
      getChampionUsage(
        allianceId,
        selectedGameAccountId ?? undefined,
        selectedWarId ?? undefined,
        groupNum,
        deathless,
        perspective,
        selectedSeasonId ?? undefined
      ),
    [allianceId, selectedGameAccountId, selectedWarId, selectedGroup, selectedSeasonId],
    Boolean(allianceId)
  )

  const handleRowClick = (gameAccountId: string) => {
    setSelectedGameAccountId((prev) => (prev === gameAccountId ? null : gameAccountId))
  }

  return {
    selectedGameAccountId,
    setSelectedGameAccountId,
    championUsage: chart.usage,
    chartMetric: chart.metric,
    setChartMetric: chart.setMetric,
    chartPerspective: chart.perspective,
    setChartPerspective: chart.setPerspective,
    detailOpen: chart.detailOpen,
    setDetailOpen: chart.setDetailOpen,
    wars: seasonWars,
    seasons,
    chartLoading: chart.chartLoading,
    handleRowClick,
  }
}

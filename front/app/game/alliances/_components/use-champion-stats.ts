'use client'

import { useEffect, useState } from 'react'
import { getChampionUsage } from '@/app/services/statistics'
import { getWars, type War } from '@/app/services/war'
import { useChampionUsageChart } from '@/app/components/statistics/use-champion-usage-chart'

export function useChampionStats(allianceId: string, selectedGroup = 'all') {
  const [selectedGameAccountId, setSelectedGameAccountId] = useState<string | null>(null)
  const [selectedWarId, setSelectedWarId] = useState<string | null>(null)
  const [wars, setWars] = useState<War[]>([])

  useEffect(() => {
    if (!allianceId) return
    getWars(allianceId)
      .then((all) => setWars(all.filter((w) => w.season_id !== null && w.status === 'ended')))
      .catch(console.error)
  }, [allianceId])

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
        perspective
      ),
    [allianceId, selectedGameAccountId, selectedWarId, selectedGroup],
    Boolean(allianceId)
  )

  const handleRowClick = (gameAccountId: string) => {
    setSelectedGameAccountId((prev) => (prev === gameAccountId ? null : gameAccountId))
  }

  return {
    selectedGameAccountId,
    setSelectedGameAccountId,
    selectedWarId,
    setSelectedWarId,
    championUsage: chart.usage,
    chartMetric: chart.metric,
    setChartMetric: chart.setMetric,
    chartPerspective: chart.perspective,
    setChartPerspective: chart.setPerspective,
    detailOpen: chart.detailOpen,
    setDetailOpen: chart.setDetailOpen,
    wars,
    chartLoading: chart.chartLoading,
    handleRowClick,
  }
}

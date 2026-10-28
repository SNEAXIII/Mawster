'use client'

import { useEffect, useState } from 'react'
import { type RankingHistoryPoint, fetchAllianceRankingHistory } from '@/app/services/game'
import type { SeasonStatus } from '@/app/services/season'
import { getSeasonWarStats, type SeasonWarStats } from '@/app/services/statistics'
import { updateWarOpponentDeaths } from '@/app/services/war'

export function useAllianceSeasonHistory(allianceId: string, seasonId: string | null) {
  const [seasonWars, setSeasonWars] = useState<SeasonWarStats[]>([])
  const [rankingPoints, setRankingPoints] = useState<RankingHistoryPoint[]>([])
  const [rankingSeasonNumber, setRankingSeasonNumber] = useState<number | null>(null)
  const [rankingSeasonStatus, setRankingSeasonStatus] = useState<SeasonStatus | null>(null)

  // No blanking on a season change: the tab pins the season right after load,
  // and emptying the rows then would drop a cell being edited.
  useEffect(() => {
    if (!allianceId) return
    let cancelled = false
    getSeasonWarStats(allianceId, seasonId ?? undefined)
      .then((wars) => {
        if (!cancelled) setSeasonWars(wars)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [allianceId, seasonId])

  useEffect(() => {
    if (!allianceId) return
    setSeasonWars([])
  }, [allianceId])

  useEffect(() => {
    if (!allianceId) return
    let cancelled = false
    fetchAllianceRankingHistory(allianceId, seasonId ?? undefined)
      .then((data) => {
        if (cancelled) return
        setRankingPoints(data.points)
        setRankingSeasonNumber(data.season_number)
        setRankingSeasonStatus(data.season_status)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [allianceId, seasonId])

  // Patch the row in place: refetching the season would collapse the edited cell
  // while the request is still in flight.
  const saveOpponentDeaths = async (warId: string, deaths: number | null) => {
    const war = await updateWarOpponentDeaths(allianceId, warId, deaths)
    setSeasonWars((prev) =>
      prev.map((w) => (w.war_id === war.id ? { ...w, opponent_deaths: war.opponent_deaths } : w))
    )
  }

  return {
    seasonWars,
    rankingPoints,
    rankingSeasonNumber,
    rankingSeasonStatus,
    saveOpponentDeaths,
  }
}

'use client'

import { useEffect, useState } from 'react'
import {
  type RankingHistoryPoint,
  type SeasonStatus,
  fetchAllianceRankingHistory,
} from '@/app/services/game'
import { getSeasonWarStats, type SeasonWarStats } from '@/app/services/statistics'
import { updateWarOpponentDeaths } from '@/app/services/war'

export function useAllianceSeasonHistory(allianceId: string, seasonId: string | null) {
  const [seasonWars, setSeasonWars] = useState<SeasonWarStats[]>([])
  const [rankingPoints, setRankingPoints] = useState<RankingHistoryPoint[]>([])
  const [rankingSeasonNumber, setRankingSeasonNumber] = useState<number | null>(null)
  const [rankingSeasonStatus, setRankingSeasonStatus] = useState<SeasonStatus | null>(null)

  useEffect(() => {
    if (!allianceId) return
    setSeasonWars([])
    getSeasonWarStats(allianceId, seasonId ?? undefined)
      .then(setSeasonWars)
      .catch(() => {})
  }, [allianceId, seasonId])

  useEffect(() => {
    if (!allianceId) return
    setRankingPoints([])
    setRankingSeasonNumber(null)
    setRankingSeasonStatus(null)
    fetchAllianceRankingHistory(allianceId)
      .then((data) => {
        setRankingPoints(data.points)
        setRankingSeasonNumber(data.season_number)
        setRankingSeasonStatus(data.season_status)
      })
      .catch(() => {})
  }, [allianceId])

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

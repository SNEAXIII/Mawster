'use client'

import { useCallback, useEffect, useState } from 'react'
import { getMatchupGrid, type MatchupGridResponse } from '@/app/services/matchups'

/**
 * Loads the attacker-centric matchup grid. Split out of `useMatchupsViewModel` so both
 * files stay under the line budget; the caller decides when `enabled` (showGrid) is true.
 */
export function useMatchupGrid(
  allianceId: string,
  enabled: boolean,
  championId: string | null,
  gameAccountId: string
) {
  const [grid, setGrid] = useState<MatchupGridResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!allianceId || !enabled || !championId) {
      setGrid(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      setGrid(await getMatchupGrid(allianceId, championId, gameAccountId || null))
    } catch {
      setError('load-failed')
      setGrid(null)
    } finally {
      setLoading(false)
    }
  }, [allianceId, enabled, championId, gameAccountId])

  useEffect(() => {
    void reload()
  }, [reload])

  return { grid, loading, error, reload }
}

'use client'

import { useEffect, useState } from 'react'
import { getCurrentSeason, type Season } from '@/app/services/season'

/**
 * Loads the active season once. Returns the active Season, or null while
 * loading / off-season. Use `season?.format` and `season?.node_count` to adapt
 * the war UI (defaults: regular / 50 when null).
 */
export function useCurrentSeason(): Season | null {
  const [season, setSeason] = useState<Season | null>(null)

  useEffect(() => {
    let active = true
    getCurrentSeason().then((s) => {
      if (active) setSeason(s)
    })
    return () => {
      active = false
    }
  }, [])

  return season
}

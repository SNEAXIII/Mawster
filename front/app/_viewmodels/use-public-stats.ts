'use client'

import { useEffect, useState } from 'react'
import { getPublicStats, type PublicStats } from '@/app/services/stats'

// Shown while the public stats endpoint loads or if it is unreachable, so the
// strip never collapses to an empty hole on the landing page.
const FALLBACK_STATS: PublicStats = {
  active_alliances: 0,
  participating_players: 0,
  knowledge_base_fights: 0,
  wars_recorded: 0,
}

export function usePublicStats() {
  const [stats, setStats] = useState<PublicStats>(FALLBACK_STATS)

  useEffect(() => {
    getPublicStats().then((s) => {
      if (s) setStats(s)
    })
  }, [])

  return stats
}

'use client'

import { useSeasonContext } from '@/app/contexts/season-context'
import type { Season } from '@/app/services/season'

/**
 * Returns the active Season, or null while loading / off-season. Use
 * `season?.format` and `season?.node_count` to adapt the war UI (defaults:
 * regular / 50 when null).
 *
 * Backed by SeasonProvider: every consumer shares the one fetch.
 */
export function useCurrentSeason(): Season | null {
  return useSeasonContext().season
}

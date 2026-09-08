'use client'

import { useEffect, useMemo, useState } from 'react'
import { fetchCatalog } from '@/app/services/tierlist'
import type { CatalogChampion } from '@/app/services/tierlist'

/**
 * Champions that exist in the catalog but nobody can own — event bosses, minions
 * and story stand-ins. They are there because the vision pipeline has to read
 * them off a screenshot; a tier list has no use for them.
 *
 * Hard-coded here as accepted debt: the fact belongs to the catalog, and the
 * real fix is an `is_playable` column on `champion` (see CONTEXT.md).
 */
const NOT_PLAYABLE = new Set(['Anti-Venomoid', 'Doombot', 'Sentinelbot', 'Symbioid'])

interface Catalog {
  champions: CatalogChampion[]
  byId: Map<string, CatalogChampion>
  knownIds: Set<string>
  seasonNumber: number | null
  loading: boolean
  error: string | null
}

/** The champion catalog, read once. Answers signed out — the page is public. */
export function useCatalog(): Catalog {
  const [champions, setChampions] = useState<CatalogChampion[]>([])
  const [seasonNumber, setSeasonNumber] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchCatalog()
      .then((catalog) => {
        if (cancelled) return
        setChampions(catalog.champions.filter((champion) => !NOT_PLAYABLE.has(champion.name)))
        setSeasonNumber(catalog.season_number)
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const byId = useMemo(
    () => new Map(champions.map((champion) => [champion.id, champion])),
    [champions]
  )
  const knownIds = useMemo(() => new Set(byId.keys()), [byId])

  return { champions, byId, knownIds, seasonNumber, loading, error }
}

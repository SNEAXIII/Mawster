'use client'

import { useEffect, useState } from 'react'
import {
  fetchCatalog,
  fetchCatalogSeasons,
  type CatalogChampion,
  type CatalogSeason,
} from '@/app/services/tierlist'
import { classRank } from '@/app/lib/champion-class'
import { NOT_PLAYABLE } from './use-catalog'

/** The season preselected: the one still running or coming, else the most recent. */
function defaultSeason(seasons: CatalogSeason[]): number | null {
  return (seasons.find((season) => season.status !== 'ended') ?? seasons[0])?.number ?? null
}

function byClassThenName(a: CatalogChampion, b: CatalogChampion): number {
  return classRank(a.champion_class) - classRank(b.champion_class) || a.name.localeCompare(b.name)
}

/** The saga tab's data: the regular seasons and the saga roles of the chosen one. */
export function useSaga() {
  const [seasons, setSeasons] = useState<CatalogSeason[] | null>(null)
  const [seasonNumber, setSeasonNumber] = useState<number | null>(null)
  const [loaded, setLoaded] = useState<{ season: number; champions: CatalogChampion[] } | null>(
    null
  )
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchCatalogSeasons()
      .then((list) => {
        if (cancelled) return
        setSeasons(list)
        setSeasonNumber(defaultSeason(list))
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (seasonNumber === null) return
    let cancelled = false
    fetchCatalog(seasonNumber)
      .then((catalog) => {
        if (cancelled) return
        const champions = catalog.champions.filter((c) => !NOT_PLAYABLE.has(c.name))
        setLoaded({ season: seasonNumber, champions })
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message)
      })
    return () => {
      cancelled = true
    }
  }, [seasonNumber])

  // A catalog from another season is not shown while the new one is in flight.
  const champions = loaded?.season === seasonNumber ? loaded.champions : null

  return {
    seasons,
    seasonNumber,
    setSeasonNumber,
    attackers: (champions ?? []).filter((c) => c.is_saga_attacker).sort(byClassThenName),
    defenders: (champions ?? []).filter((c) => c.is_saga_defender).sort(byClassThenName),
    loading: champions === null && seasonNumber !== null,
    error,
  }
}

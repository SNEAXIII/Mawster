'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  type AllianceRosterEntry,
  type AllianceRosterQuery,
  getAllianceRoster,
} from '@/app/services/game'
import { useAllianceContext } from '@/app/contexts/alliance-context'
import { MAX_SIGNATURE, type RosterFilters } from '@/components/roster/roster-filters'

/** Max distinct champions the API returns unless the user asks for all. */
const DISTINCT_CHAMPION_LIMIT = 20
/** Debounce for the free-text name filter before hitting the API. */
const NAME_DEBOUNCE_MS = 300

export function useAllianceRosterSearch(
  allianceId: string,
  filters: RosterFilters,
  group: string,
  showAll: boolean
) {
  const { getRoleFor } = useAllianceContext()
  const [roster, setRoster] = useState<AllianceRosterEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [debouncedName, setDebouncedName] = useState('')

  // Debounce the free-text name filter so typing doesn't hammer the API.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedName(filters.name), NAME_DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [filters.name])

  // Server-side query: all filtering + the distinct-champion cap happen in the API.
  const query = useMemo<AllianceRosterQuery>(
    () => ({
      name: debouncedName,
      championClass: filters.championClass || undefined,
      ranks: filters.ranks.length ? filters.ranks : undefined,
      ascensions: filters.ascensions.length ? filters.ascensions : undefined,
      sagaAttacker: filters.sagaAttacker || undefined,
      sagaDefender: filters.sagaDefender || undefined,
      preferredAttacker: filters.preferredAttacker || undefined,
      allianceGroup: /^\d+$/.test(group) ? Number(group) : undefined,
      noGroup: group === 'none' || undefined,
      minSignature: filters.minSignature || undefined,
      maxSignature: filters.maxSignature < MAX_SIGNATURE ? filters.maxSignature : undefined,
      distinctChampionLimit: showAll ? undefined : DISTINCT_CHAMPION_LIMIT,
    }),
    [
      debouncedName,
      filters.championClass,
      filters.ranks,
      filters.ascensions,
      filters.sagaAttacker,
      filters.sagaDefender,
      filters.preferredAttacker,
      filters.minSignature,
      filters.maxSignature,
      group,
      showAll,
    ]
  )

  const role = allianceId ? getRoleFor(allianceId) : undefined
  const canRequestUpgrade = !!role && (role.is_officer || role.is_owner)

  useEffect(() => {
    if (!allianceId) {
      setRoster([])
      return
    }
    // Filters change faster than the API answers: ignore a response that is no longer
    // the current query, otherwise a slow earlier request overwrites a fresher one.
    let stale = false
    setLoading(true)
    getAllianceRoster(allianceId, query)
      .then((entries) => {
        if (!stale) setRoster(entries)
      })
      .catch(() => {
        if (!stale) setRoster([])
      })
      .finally(() => {
        if (!stale) setLoading(false)
      })
    return () => {
      stale = true
    }
  }, [allianceId, query])

  // Group the returned entries by champion for display (API already filtered + capped).
  const groups = useMemo(() => {
    const byChampion = new Map<string, AllianceRosterEntry[]>()
    for (const e of roster) {
      const list = byChampion.get(e.champion_id) ?? []
      list.push(e)
      byChampion.set(e.champion_id, list)
    }
    return Array.from(byChampion.values())
      .map((entries) => ({
        championId: entries[0].champion_id,
        championName: entries[0].champion_name,
        championClass: entries[0].champion_class,
        imageUrl: entries[0].image_url,
        entries,
      }))
      .sort((a, b) => a.championName.localeCompare(b.championName))
  }, [roster])

  return { groups, loading, canRequestUpgrade }
}

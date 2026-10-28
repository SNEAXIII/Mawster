'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { getRoster, RARITIES, type RosterEntry } from '@/app/services/roster'
import { useAccountMasteries } from '@/app/game/account/_viewmodels/use-account-masteries'
import {
  EMPTY_FILTERS,
  type RosterFilters,
  applyRosterFilters,
  isFilterActive,
} from '@/components/roster/roster-filters'

export function useMemberRoster(
  open: boolean,
  gameAccountId: string | null,
  loadExtras: (gameAccountId: string) => Promise<unknown>,
  errorMessage: string
) {
  const [roster, setRoster] = useState<RosterEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState<RosterFilters>(EMPTY_FILTERS)

  useEffect(() => {
    if (!open || !gameAccountId) return
    setLoading(true)
    setError('')
    setFilters(EMPTY_FILTERS)
    Promise.all([getRoster(gameAccountId), loadExtras(gameAccountId)])
      .then(([rosterData]) => setRoster(rosterData))
      .catch(() => setError(errorMessage))
      .finally(() => setLoading(false))
    // oxlint-disable-next-line react/exhaustive-deps
  }, [open, gameAccountId])

  const { masteries, loading: masteriesLoading } = useAccountMasteries(open, gameAccountId ?? '')

  const filteredRoster = useMemo(() => applyRosterFilters(roster, filters), [roster, filters])

  const availableClasses = useMemo(
    () =>
      Array.from(new Set(roster.map((r) => r.champion_class))).sort((a, b) => a.localeCompare(b)),
    [roster]
  )

  const groupedRoster = useMemo(() => {
    const groups: [string, RosterEntry[]][] = []
    for (const rarity of [...RARITIES].reverse()) {
      const entries = filteredRoster.filter((r) => r.rarity === rarity)
      if (entries.length > 0) groups.push([rarity, entries])
    }
    return groups
  }, [filteredRoster])

  const setFilterPatch = useCallback(
    (patch: Partial<RosterFilters>) => setFilters((prev) => ({ ...prev, ...patch })),
    []
  )
  const resetFilters = useCallback(() => setFilters(EMPTY_FILTERS), [])

  return {
    roster,
    masteries,
    loading: loading || masteriesLoading,
    error,
    groupedRoster,
    filters,
    setFilterPatch,
    resetFilters,
    availableClasses,
    filteredCount: filteredRoster.length,
    hasActiveFilters: isFilterActive(filters),
  }
}

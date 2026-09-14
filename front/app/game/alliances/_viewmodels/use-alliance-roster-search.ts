'use client'

import { useEffect, useState } from 'react'
import {
  type AllianceRosterEntry,
  type AllianceRosterQuery,
  getAllianceRoster,
} from '@/app/services/game'
import { useAllianceContext } from '@/app/contexts/alliance-context'

export function useAllianceRosterSearch(allianceId: string, query: AllianceRosterQuery) {
  const { getRoleFor } = useAllianceContext()
  const [roster, setRoster] = useState<AllianceRosterEntry[]>([])
  const [loading, setLoading] = useState(false)

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

  return { roster, loading, canRequestUpgrade }
}

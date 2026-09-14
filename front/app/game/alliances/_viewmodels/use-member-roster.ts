'use client'

import { useEffect, useState } from 'react'
import { getRoster, type RosterEntry } from '@/app/services/roster'
import { getMasteries, type MasteryEntry } from '@/app/services/masteries'

export function useMemberRoster(
  open: boolean,
  gameAccountId: string | null,
  loadExtras: (gameAccountId: string) => Promise<unknown>,
  errorMessage: string
) {
  const [roster, setRoster] = useState<RosterEntry[]>([])
  const [masteries, setMasteries] = useState<MasteryEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || !gameAccountId) return
    setLoading(true)
    setError('')
    Promise.all([getRoster(gameAccountId), loadExtras(gameAccountId), getMasteries(gameAccountId)])
      .then(([rosterData, , masteryData]) => {
        setRoster(rosterData)
        setMasteries(masteryData)
      })
      .catch(() => setError(errorMessage))
      .finally(() => setLoading(false))
    // oxlint-disable-next-line react/exhaustive-deps
  }, [open, gameAccountId])

  return { roster, masteries, loading, error }
}

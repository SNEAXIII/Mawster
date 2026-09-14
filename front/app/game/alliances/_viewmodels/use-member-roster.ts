'use client'

import { useEffect, useState } from 'react'
import { getRoster, type RosterEntry } from '@/app/services/roster'
import { useAccountMasteries } from '@/app/game/account/_viewmodels/use-account-masteries'

export function useMemberRoster(
  open: boolean,
  gameAccountId: string | null,
  loadExtras: (gameAccountId: string) => Promise<unknown>,
  errorMessage: string
) {
  const [roster, setRoster] = useState<RosterEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || !gameAccountId) return
    setLoading(true)
    setError('')
    Promise.all([getRoster(gameAccountId), loadExtras(gameAccountId)])
      .then(([rosterData]) => setRoster(rosterData))
      .catch(() => setError(errorMessage))
      .finally(() => setLoading(false))
    // oxlint-disable-next-line react/exhaustive-deps
  }, [open, gameAccountId])

  const { masteries, loading: masteriesLoading } = useAccountMasteries(open, gameAccountId ?? '')

  return { roster, masteries, loading: loading || masteriesLoading, error }
}

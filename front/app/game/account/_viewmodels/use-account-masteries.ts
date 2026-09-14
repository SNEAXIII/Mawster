'use client'

import { useEffect, useState } from 'react'
import { getMasteries, type MasteryEntry } from '@/app/services/masteries'

export function useAccountMasteries(open: boolean, gameAccountId: string) {
  const [masteries, setMasteries] = useState<MasteryEntry[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !gameAccountId) return
    setLoading(true)
    getMasteries(gameAccountId)
      .then(setMasteries)
      .catch(() => setMasteries([]))
      .finally(() => setLoading(false))
  }, [open, gameAccountId])

  return { masteries, loading }
}

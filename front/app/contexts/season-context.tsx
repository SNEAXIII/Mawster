'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { getCurrentSeason, type Season } from '@/app/services/season'

interface SeasonContextValue {
  season: Season | null
  loading: boolean
  refresh: () => Promise<void>
}

const SeasonContext = createContext<SeasonContextValue>({
  season: null,
  loading: true,
  refresh: async () => {},
})

/**
 * Holds the active season for the whole app.
 *
 * It used to be fetched per component, so a war page mounting the tab, the
 * attacker selector and the defense content hit /seasons/current three times
 * for one value that changes a few times a season.
 */
export function SeasonProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const { status } = useSession()
  const [season, setSeason] = useState<Season | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (status !== 'authenticated') {
      setSeason(null)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      setSeason(await getCurrentSeason())
    } catch {
      setSeason(null)
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => {
    if (status === 'loading') return
    refresh()
  }, [refresh, status])

  const value = useMemo(() => ({ season, loading, refresh }), [season, loading, refresh])

  return <SeasonContext.Provider value={value}>{children}</SeasonContext.Provider>
}

export function useSeasonContext() {
  return useContext(SeasonContext)
}

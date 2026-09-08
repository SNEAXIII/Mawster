'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { createTierList, deleteTierList, fetchTierLists } from '@/app/services/tierlist'
import type { TierListSummary } from '@/app/services/tierlist'
import { defaultBoard } from '../_lib/board'
import { toSavePayload } from '../_lib/types'

interface TierLists {
  lists: TierListSummary[]
  loading: boolean
  error: string | null
  /** Create an empty list and return it, so the caller can switch to it. */
  create: () => Promise<TierListSummary | null>
  remove: (id: string) => Promise<void>
  refresh: () => Promise<void>
}

/**
 * The tier lists an account holds, as the picker shows them: names and counts,
 * never their contents. Signed out there are none — the browser keeps a single
 * board and no list to pick from.
 */
export function useTierLists(): TierLists {
  const { status } = useSession()
  const signedIn = status === 'authenticated'
  const [lists, setLists] = useState<TierListSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!signedIn) {
      setLists([])
      setLoading(false)
      return
    }
    try {
      setLists(await fetchTierLists())
      setError(null)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [signedIn])

  useEffect(() => {
    if (status === 'loading') return
    void refresh()
  }, [status, refresh])

  const create = useCallback(async () => {
    try {
      const created = await createTierList(toSavePayload(defaultBoard()))
      await refresh()
      return {
        id: created.id,
        title: created.title,
        created_at: created.created_at,
        tier_count: created.tiers.length,
        ranked_champion_count: 0,
      }
    } catch (err) {
      setError((err as Error).message)
      return null
    }
  }, [refresh])

  const remove = useCallback(
    async (id: string) => {
      try {
        await deleteTierList(id)
        await refresh()
      } catch (err) {
        setError((err as Error).message)
      }
    },
    [refresh]
  )

  return { lists, loading, error, create, remove, refresh }
}

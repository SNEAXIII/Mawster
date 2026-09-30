'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useI18n } from '@/app/i18n'
import { useVisiblePoll } from '@/hooks/use-visible-poll'

/** Shared refetch/poll plumbing: resets the poll timer after every fetch so a manual
 *  refresh is never immediately followed by a stray tick from a stale interval. */
export function usePolledFetch(
  loader: (silent: boolean, isStale: () => boolean) => Promise<void>,
  ready: boolean,
  pollEnabled: boolean,
  onNotReady?: () => void
) {
  const { t } = useI18n()
  const [loading, setLoading] = useState(false)
  const requestIdRef = useRef(0)

  const refresh = useCallback(
    async (silent = false) => {
      if (!ready) {
        onNotReady?.()
        return
      }
      const requestId = ++requestIdRef.current
      const isStale = () => requestId !== requestIdRef.current
      if (!silent) setLoading(true)
      try {
        await loader(silent, isStale)
      } catch {
        if (!silent && !isStale()) toast.error(t.game.defense.loadError)
      } finally {
        if (!silent && !isStale()) setLoading(false)
      }
    },
    [loader, ready, onNotReady, t]
  )

  const refreshRef = useRef(refresh)
  useEffect(() => {
    refreshRef.current = refresh
  }, [refresh])

  const resetPollTimer = useVisiblePoll(() => refreshRef.current(true), 10_000, pollEnabled)

  useEffect(() => {
    void refresh()
    resetPollTimer()
    // oxlint-disable-next-line react/exhaustive-deps -- resetPollTimer is stable
  }, [refresh])

  return { loading, refresh, resetPollTimer }
}

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useI18n } from '@/app/i18n'
import { useVisiblePoll } from '@/hooks/use-visible-poll'

/**
 * Shared refetch/poll plumbing for the plan-editor-shaped hooks (usePlanEditor,
 * useActivePlan): owns the loading flag, keeps the poll callback current via a
 * ref, and resets the poll timer after every fetch so a manual refresh is never
 * immediately followed by a stray tick from a stale interval.
 *
 * `ready` gates the fetch itself, calling `onNotReady` instead when false;
 * `pollEnabled` gates the background poll — kept separate because the two
 * hooks disagree on whether an alliance id alone should suspend polling.
 */
export function usePolledFetch(
  loader: (silent: boolean) => Promise<void>,
  ready: boolean,
  pollEnabled: boolean,
  onNotReady?: () => void
) {
  const { t } = useI18n()
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(
    async (silent = false) => {
      if (!ready) {
        onNotReady?.()
        return
      }
      if (!silent) setLoading(true)
      try {
        await loader(silent)
      } catch {
        if (!silent) toast.error(t.game.defense.loadError)
      } finally {
        if (!silent) setLoading(false)
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
    refresh()
    resetPollTimer()
    // oxlint-disable-next-line react/exhaustive-deps -- resetPollTimer is stable
  }, [refresh])

  return { loading, refresh, resetPollTimer }
}

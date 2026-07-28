import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getCurrentVisionImport,
  getVisionImport,
  cancelVisionImport,
  retryVisionJob,
  type CurrentVisionImport,
} from '@/app/services/vision'

const POLL_INTERVAL_MS = 1500
const POLL_MAX_ITERATIONS = 120
export const VISION_BANNER_ACTIVE_STATUSES = new Set(['pending', 'running'])

export interface UseVisionImportBannerProps {
  gameAccountId: string
  // Bumped by the parent whenever the underlying import may have changed
  // outside this hook (e.g. confirmed via the review popup) — there is no
  // other way for a hook that only polls while pending/running to learn that.
  refreshSignal: number
}

// Fetches the one AI import still awaiting attention on this account, polling
// while it is pending/running, and exposes cancel/retry. Mirrors the polling
// shape of useRosterImportVision's pollImport: a ref-held timer, an
// iteration cap, and a status check driven by the freshly fetched result
// rather than a stale closure.
export function useVisionImportBanner({
  gameAccountId,
  refreshSignal,
}: UseVisionImportBannerProps) {
  const [current, setCurrent] = useState<CurrentVisionImport | null>(null)
  const [busy, setBusy] = useState(false)

  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollCountRef = useRef(0)
  const pollBusyRef = useRef(false)

  const clearPoll = useCallback(() => {
    if (pollTimerRef.current != null) {
      clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }, [])

  useEffect(() => clearPoll, [clearPoll])

  const load = useCallback(async () => {
    const result = await getCurrentVisionImport(gameAccountId)
    setCurrent(result)
    return result
  }, [gameAccountId])

  const startPoll = useCallback(() => {
    clearPoll()
    pollCountRef.current = 0
    pollBusyRef.current = false

    pollTimerRef.current = setInterval(() => {
      if (pollBusyRef.current) return
      pollBusyRef.current = true
      pollCountRef.current += 1

      void (async () => {
        try {
          const result = await load()
          const stillActive = result != null && VISION_BANNER_ACTIVE_STATUSES.has(result.status)
          if (!stillActive || pollCountRef.current >= POLL_MAX_ITERATIONS) clearPoll()
        } catch {
          clearPoll()
        } finally {
          pollBusyRef.current = false
        }
      })()
    }, POLL_INTERVAL_MS)
  }, [clearPoll, load])

  useEffect(() => {
    clearPoll()
    let cancelled = false
    void (async () => {
      const result = await load().catch(() => null)
      if (cancelled || result == null) return
      if (VISION_BANNER_ACTIVE_STATUSES.has(result.status)) startPoll()
    })()
    return () => {
      cancelled = true
      clearPoll()
    }
  }, [gameAccountId, refreshSignal, load, startPoll, clearPoll])

  const cancel = useCallback(async () => {
    if (current == null) return
    setBusy(true)
    try {
      await cancelVisionImport(current.id)
      clearPoll()
      setCurrent(null)
    } finally {
      setBusy(false)
    }
  }, [current, clearPoll])

  const retry = useCallback(async () => {
    if (current == null) return
    setBusy(true)
    try {
      const detail = await getVisionImport(current.id)
      const failedJobs = (detail.jobs ?? []).filter((job) => job.status === 'failed')
      await Promise.all(failedJobs.map((job) => retryVisionJob(job.id)))
      const result = await load()
      if (result != null && VISION_BANNER_ACTIVE_STATUSES.has(result.status)) startPoll()
    } finally {
      setBusy(false)
    }
  }, [current, load, startPoll])

  return { current, busy, cancel, retry }
}

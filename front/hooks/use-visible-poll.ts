'use client'

import { useCallback, useEffect, useRef } from 'react'

/**
 * Runs `callback` on an interval, but only while the tab is on screen.
 *
 * A war or defense page stays open in a background tab for hours, and every tick
 * costs a full round trip — including the session decrypt the `/api/back` proxy
 * does on each request — for data nobody is looking at. Hiding the tab stops the
 * timer; showing it again fetches once immediately, so what the user sees on
 * return is current rather than up to one interval old.
 *
 * Returns a `reset` that restarts the interval from now: call it after a mutation
 * that already refreshed the data, so the next poll is a full interval away
 * instead of firing right behind it.
 */
export function useVisiblePoll(callback: () => void, intervalMs: number, enabled: boolean) {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  const enabledRef = useRef(enabled)
  enabledRef.current = enabled

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stop = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
  }, [])

  const reset = useCallback(() => {
    stop()
    if (!enabledRef.current || document.visibilityState !== 'visible') return
    timerRef.current = setInterval(() => callbackRef.current(), intervalMs)
  }, [intervalMs, stop])

  useEffect(() => {
    if (!enabled) {
      stop()
      return
    }

    reset()

    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') {
        stop()
        return
      }
      callbackRef.current()
      reset()
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      stop()
    }
  }, [enabled, reset, stop])

  return reset
}

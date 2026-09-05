'use client'

import { useEffect, useRef } from 'react'
import { BUILD_ID } from '@/app/lib/build-id'

const POLL_INTERVAL_MS = 60_000

/**
 * Notices that the server now serves a build newer than the one this tab runs.
 *
 * A deploy replaces the code on the server, never the code already loaded in an
 * open tab: client-side navigation renders from the JS held in memory and never
 * refetches the document. Nothing can be pushed to those tabs, so the tab has
 * to ask — hence the poll against `/api/version`.
 *
 * A hidden tab is reloaded on the spot, which costs the user nothing and is why
 * most people will never see a prompt at all. A visible tab only calls
 * `onStale`: reloading under someone mid-way through placing defenders would
 * throw their work away.
 */
export function useVersionCheck(onStale: () => void) {
  const staleRef = useRef(false)
  const onStaleRef = useRef(onStale)
  onStaleRef.current = onStale

  useEffect(() => {
    if (!BUILD_ID) return

    let cancelled = false

    const check = async () => {
      if (cancelled || staleRef.current) return
      try {
        const response = await fetch('/api/version', { cache: 'no-store' })
        if (!response.ok) return
        const { buildId } = (await response.json()) as { buildId?: string }
        if (cancelled || !buildId || buildId === BUILD_ID) return

        if (document.visibilityState === 'hidden') {
          window.location.reload()
          return
        }
        staleRef.current = true
        onStaleRef.current()
      } catch {
        // Offline, or a replica restarting mid-deploy. The next tick retries.
      }
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void check()
    }

    void check()
    const timer = setInterval(() => void check(), POLL_INTERVAL_MS)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      cancelled = true
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])
}

'use client'

import { useEffect } from 'react'

const RELOAD_MARK_KEY = 'mawster-chunk-reload-at'
const RELOAD_COOLDOWN_MS = 30_000

const CHUNK_ERROR_PATTERN =
  /ChunkLoadError|Loading chunk \S+ failed|Failed to fetch dynamically imported module/i

function describes(value: unknown): string {
  if (value instanceof Error) return `${value.name}: ${value.message}`
  return typeof value === 'string' ? value : ''
}

/**
 * Recovers from a chunk that vanished under the tab's feet.
 *
 * `order: start-first` means the two front replicas serve different builds for
 * a few seconds during a rolling update, so a tab on the old one can request a
 * chunk the new one no longer has. That leaves a broken page, not merely a
 * stale one, and no prompt would help — reload it.
 *
 * The cooldown is what keeps a genuinely missing chunk from becoming a reload
 * loop: a boot that fails immediately retries well inside the window and stops,
 * while a session that ran fine for a while is free to recover again later.
 */
export function useChunkErrorRecovery() {
  useEffect(() => {
    const recover = (value: unknown) => {
      if (!CHUNK_ERROR_PATTERN.test(describes(value))) return
      try {
        const lastReload = Number(sessionStorage.getItem(RELOAD_MARK_KEY) ?? 0)
        if (Date.now() - lastReload < RELOAD_COOLDOWN_MS) return
        sessionStorage.setItem(RELOAD_MARK_KEY, String(Date.now()))
      } catch {
        // Storage denied (private mode): recovering once beats staying broken.
      }
      window.location.reload()
    }

    const onError = (event: ErrorEvent) => recover(event.error ?? event.message)
    const onRejection = (event: PromiseRejectionEvent) => recover(event.reason)

    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)

    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])
}

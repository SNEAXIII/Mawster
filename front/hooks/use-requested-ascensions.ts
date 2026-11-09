'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { createAscensionRequest, getRequestedChampionIds } from '@/app/services/ascension-requests'

let requested: ReadonlySet<string> = new Set()
let sharedIds: Promise<void> | null = null
const listeners = new Set<() => void>()

function setRequested(next: ReadonlySet<string>) {
  requested = next
  listeners.forEach((listener) => listener())
}

function getRequested() {
  return requested
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

// ponytail: hand-rolled cache, move to TanStack Query along with the catalog caches.
function loadRequestedIds(): Promise<void> {
  sharedIds ??= getRequestedChampionIds()
    .then((ids) => setRequested(new Set([...requested, ...ids])))
    .catch((err: unknown) => {
      sharedIds = null
      throw err
    })
  return sharedIds
}

/** Champion ids with a pending Ascension Request, shared by every mounted button. */
export function useRequestedAscensions() {
  const ids = useSyncExternalStore(subscribe, getRequested, getRequested)

  useEffect(() => {
    loadRequestedIds().catch(() => {})
  }, [])

  return {
    isRequested: (championId: string) => ids.has(championId),
    request: async (championId: string) => {
      await createAscensionRequest(championId)
      setRequested(new Set([...requested, championId]))
    },
  }
}

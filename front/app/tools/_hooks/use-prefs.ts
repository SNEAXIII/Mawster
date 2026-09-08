'use client'

import { useEffect, useState } from 'react'
import { readStored, writeStored } from '../_lib/storage'

const STORAGE_NAME = 'prefs'

export interface DisplayPrefs {
  cardSize: number
  showNames: boolean
  showBadges: boolean
}

const DEFAULTS: DisplayPrefs = { cardSize: 64, showNames: false, showBadges: true }

/**
 * View-only preferences. Kept out of the board on purpose: they describe this
 * browser, not the tier list, so opening someone's list must never resize your
 * cards — and they have no business travelling to the server.
 */
export function usePrefs(): [DisplayPrefs, (patch: Partial<DisplayPrefs>) => void] {
  const [prefs, setPrefs] = useState<DisplayPrefs>(DEFAULTS)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const raw = readStored(STORAGE_NAME)
      if (raw) setPrefs({ ...DEFAULTS, ...(JSON.parse(raw) as Partial<DisplayPrefs>) })
    } catch {
      // Corrupted value — the defaults are fine.
    }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (hydrated) writeStored(STORAGE_NAME, JSON.stringify(prefs))
  }, [prefs, hydrated])

  return [prefs, (patch) => setPrefs((current) => ({ ...current, ...patch }))]
}

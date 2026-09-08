'use client'

import { useEffect, useState } from 'react'
import { readStored, writeStored } from '../_lib/storage'

const STORAGE_NAME = 'prefs'

/**
 * Which star frame the cards are drawn in: the champion's own rarity, or one
 * forced on every card — a board meant to read as "my 7-star roster" shows the
 * 7★ frame throughout, whatever the catalog says.
 */
export type StarMode = 'all' | '7' | '6'

export interface DisplayPrefs {
  cardSize: number
  showNames: boolean
  showBadges: boolean
  starMode: StarMode
}

const DEFAULTS: DisplayPrefs = {
  cardSize: 64,
  showNames: false,
  showBadges: true,
  starMode: 'all',
}

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

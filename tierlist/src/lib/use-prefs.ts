import { useEffect, useState } from 'react'

const STORAGE_KEY = 'mawster-tierlist:prefs'

export interface DisplayPrefs {
  cardSize: number
  showNames: boolean
  showBadges: boolean
}

const DEFAULTS: DisplayPrefs = { cardSize: 64, showNames: false, showBadges: true }

/**
 * View-only preferences. Kept out of `BoardState` on purpose: they describe
 * this browser, not the tier list, so importing someone else's export must not
 * resize your cards.
 */
export function usePrefs(): [DisplayPrefs, (patch: Partial<DisplayPrefs>) => void] {
  const [prefs, setPrefs] = useState<DisplayPrefs>(DEFAULTS)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setPrefs({ ...DEFAULTS, ...(JSON.parse(raw) as Partial<DisplayPrefs>) })
    } catch {
      // Unreadable storage — the defaults are fine.
    }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
    } catch {
      // Storage blocked — preferences stay session-only.
    }
  }, [prefs, hydrated])

  return [prefs, (patch) => setPrefs((p) => ({ ...p, ...patch }))]
}

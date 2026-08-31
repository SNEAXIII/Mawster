import { useCallback, useEffect, useState } from 'react'
import { LOCALES, type Dictionary, type LocaleKey } from './locales'

const STORAGE_KEY = 'mawster-tierlist:locale'

function detect(): LocaleKey {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'en' || stored === 'fr') return stored
  return navigator.language.toLowerCase().startsWith('fr') ? 'fr' : 'en'
}

/**
 * Minimal locale hook — the app is a single screen, so a dictionary swap in
 * component state is enough; no provider or context needed.
 */
export function useI18n(): { t: Dictionary; locale: LocaleKey; setLocale: (l: LocaleKey) => void } {
  const [locale, setLocaleState] = useState<LocaleKey>('en')

  // Read after mount: `detect` touches localStorage and navigator, which are
  // unavailable if this ever renders outside the browser.
  useEffect(() => setLocaleState(detect()), [])

  const setLocale = useCallback((l: LocaleKey) => {
    localStorage.setItem(STORAGE_KEY, l)
    setLocaleState(l)
    document.documentElement.lang = l
  }, [])

  return { t: LOCALES[locale], locale, setLocale }
}

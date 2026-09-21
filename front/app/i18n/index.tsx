'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import en, { type Translations } from './locales/en'
import fr from './locales/fr'

export type Locale = 'en' | 'fr'

const locales: Record<Locale, Translations> = { en, fr }

const STORAGE_KEY = 'mawster-locale'
const DEFAULT_LOCALE: Locale = 'en'

interface I18nContextType {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: Translations
}

const I18nContext = createContext<I18nContextType>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: en,
})

export function I18nProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Locale | null
    if (stored && locales[stored]) {
      setLocale(stored)
    }
  }, [])

  const changeLocale = useCallback((newLocale: Locale) => {
    setLocale(newLocale)
    localStorage.setItem(STORAGE_KEY, newLocale)
  }, [])

  const value = useMemo(
    () => ({ locale, setLocale: changeLocale, t: locales[locale] }),
    [locale, changeLocale]
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  return useContext(I18nContext)
}

export { type Translations }

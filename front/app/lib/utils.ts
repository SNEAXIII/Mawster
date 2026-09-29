import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { Locale } from '@/app/i18n'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const truncateString = (str: string, maxLength: number): string => {
  return str.length > maxLength ? `${str.slice(0, maxLength)}...` : str
}

const DATE_PRESETS = {
  short: { year: 'numeric', month: 'long', day: 'numeric' },
  medium: { dateStyle: 'medium' },
  long: { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' },
} satisfies Record<string, Intl.DateTimeFormatOptions>

// Intl resolves 'en' to en-US and 'fr' to fr-FR.
export const formatDate = (
  date: string,
  locale: Locale,
  preset: keyof typeof DATE_PRESETS
): string => new Date(date).toLocaleString(locale, DATE_PRESETS[preset])

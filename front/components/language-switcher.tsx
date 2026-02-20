'use client';

import { useI18n, Locale } from '@/app/i18n';
import { Button } from '@/components/ui/button';

const flags: Record<Locale, string> = {
  en: '🇬🇧',
  fr: '🇫🇷',
};

export default function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();
  const nextLocale: Locale = locale === 'en' ? 'fr' : 'en';

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setLocale(nextLocale)}
      className="text-lg px-2"
      aria-label={`Switch to ${nextLocale === 'en' ? 'English' : 'Français'}`}
    >
      {flags[nextLocale]}
    </Button>
  );
}

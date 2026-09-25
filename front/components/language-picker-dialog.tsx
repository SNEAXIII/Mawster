'use client'

import { useI18n, type Locale } from '@/app/i18n'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const flags: Record<Locale, string> = {
  en: '🇬🇧',
  fr: '🇫🇷',
}

/** Asks for the site language on the first visit, until a choice is stored. */
export default function LanguagePickerDialog() {
  const { t, locale, setLocale, hasChosenLocale } = useI18n()
  const labels: Record<Locale, string> = {
    en: t.common.languagePicker.english,
    fr: t.common.languagePicker.french,
  }

  return (
    <Dialog
      open={hasChosenLocale === false}
      // Dismissing keeps the current language, so the dialog does not come back
      onOpenChange={(open) => !open && setLocale(locale)}
    >
      <DialogContent
        className='sm:max-w-sm'
        data-cy='language-picker-dialog'
      >
        <DialogHeader>
          <DialogTitle>{t.common.languagePicker.title}</DialogTitle>
          <DialogDescription>{t.common.languagePicker.description}</DialogDescription>
        </DialogHeader>
        <div className='grid grid-cols-2 gap-3'>
          {(Object.keys(flags) as Locale[]).map((code) => (
            <Button
              key={code}
              variant={code === locale ? 'default' : 'outline'}
              className='h-auto flex-col gap-1 py-4'
              onClick={() => setLocale(code)}
              data-cy={`language-picker-${code}`}
            >
              <span className='text-2xl'>{flags[code]}</span>
              <span>{labels[code]}</span>
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

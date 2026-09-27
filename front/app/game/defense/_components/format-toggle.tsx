'use client'

import { useI18n } from '@/app/i18n'
import { Button } from '@/components/ui/button'
import type { SeasonFormat } from '@/app/services/season'

const FORMATS: SeasonFormat[] = ['regular', 'big_thing']

export default function FormatToggle({
  value,
  onChange,
}: Readonly<{ value: SeasonFormat; onChange: (format: SeasonFormat) => void }>) {
  const { t } = useI18n()
  return (
    <div className='flex items-center gap-2'>
      <span className='text-sm font-medium'>{t.game.defense.formats.label}:</span>
      <div className='flex gap-1'>
        {FORMATS.map((format) => (
          <Button
            key={format}
            size='sm'
            variant={value === format ? 'default' : 'outline'}
            onClick={() => onChange(format)}
            data-cy={`defense-format-${format}`}
          >
            {t.game.defense.formats[format]}
          </Button>
        ))}
      </div>
    </div>
  )
}

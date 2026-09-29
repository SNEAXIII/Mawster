'use client'

import { useI18n } from '@/app/i18n'
import { ToggleButton, ToggleGroup } from '@/components/toggle-button'
import type { SeasonFormat } from '@/app/services/season'

const FORMATS: SeasonFormat[] = ['regular', 'big_thing']

export default function FormatToggle({
  value,
  onChange,
}: Readonly<{ value: SeasonFormat; onChange: (format: SeasonFormat) => void }>) {
  const { t } = useI18n()
  return (
    <div className='flex items-center gap-2'>
      <span className='text-sm font-medium whitespace-nowrap'>{t.game.defense.formats.label}:</span>
      <ToggleGroup>
        {FORMATS.map((format) => (
          <ToggleButton
            key={format}
            active={value === format}
            onClick={() => onChange(format)}
            dataCy={`defense-format-${format}`}
          >
            {t.game.defense.formats[format]}
          </ToggleButton>
        ))}
      </ToggleGroup>
    </div>
  )
}

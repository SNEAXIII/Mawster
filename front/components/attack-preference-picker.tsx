'use client'

import { useI18n } from '@/app/i18n'
import type { AttackPreference } from '@/app/services/roster'
import { ToggleButton, ToggleGroup } from '@/components/toggle-button'

const ORDER: AttackPreference[] = ['detested', 'neutral', 'preferred']
const ACTIVE: Record<AttackPreference, string> = {
  detested: 'bg-red-600 text-white',
  neutral: 'bg-blue-600 text-white',
  preferred: 'bg-amber-400 text-black',
}

interface AttackPreferencePickerProps {
  value: AttackPreference
  onChange: (value: AttackPreference) => void
}

export default function AttackPreferencePicker({
  value,
  onChange,
}: Readonly<AttackPreferencePickerProps>) {
  const { t } = useI18n()
  return (
    <div className='flex flex-col items-start gap-1.5'>
      <span className='text-sm font-medium'>{t.roster.attackPreference.label}</span>
      <ToggleGroup dataCy='attack-preference-picker'>
        {ORDER.map((pref) => (
          <ToggleButton
            key={pref}
            active={value === pref}
            onClick={() => onChange(pref)}
            dataCy={`attack-preference-${pref}`}
            activeClassName={ACTIVE[pref]}
            className='px-2 py-0.5 text-xs'
          >
            {t.roster.attackPreference[pref]}
          </ToggleButton>
        ))}
      </ToggleGroup>
    </div>
  )
}

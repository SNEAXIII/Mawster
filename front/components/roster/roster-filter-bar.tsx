'use client'

import type { ReactNode } from 'react'
import { useI18n } from '@/app/i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/app/lib/utils'
import { RARITY_LABELS } from '@/app/services/roster'
import ClassFilterSelect from '@/components/class-filter-select'
import {
  type RosterFilters,
  RANK_OPTIONS,
  ASCENSION_OPTIONS,
  MAX_SIGNATURE,
  isFilterActive,
  optionRange,
  optionSlice,
} from './roster-filters'
import LabeledSlider from '@/components/labeled-slider'

interface RosterFilterBarProps {
  filters: RosterFilters
  onChange: (patch: Partial<RosterFilters>) => void
  onReset: () => void
  availableClasses: readonly string[]
  /** Only read when `showCount` is on. */
  filteredCount?: number
  /** Only read when `showCount` is on. */
  totalCount?: number
  /** Optional control rendered at the start of the filter row (e.g. a group selector). */
  leading?: ReactNode
  /** Optional control rendered after the last filter, before the reset button. */
  trailing?: ReactNode
  /** Show the "{filtered} / {total}" count line. Default true. */
  showCount?: boolean
}

export default function RosterFilterBar({
  filters,
  onChange,
  onReset,
  availableClasses,
  filteredCount = 0,
  totalCount = 0,
  leading,
  trailing,
  showCount = true,
}: Readonly<RosterFilterBarProps>) {
  const { t } = useI18n()
  const f = t.roster.filter

  const boolToggle = (
    key: 'sagaAttacker' | 'sagaDefender' | 'preferredAttacker',
    label: string,
    cy: string
  ) => (
    <Button
      type='button'
      variant='outline'
      size='sm'
      data-cy={cy}
      className={cn(filters[key] && 'bg-primary/10 border-primary text-primary')}
      onClick={() => onChange({ [key]: !filters[key] })}
    >
      {label}
    </Button>
  )

  return (
    <div className='mb-4 space-y-2'>
      <div className='flex flex-wrap items-center gap-3'>
        {leading}
        {/* Left: name + class */}
        <Input
          value={filters.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder={f.namePlaceholder}
          className='h-8 w-44 text-xs'
          data-cy='roster-filter-name'
        />
        {availableClasses.length > 0 && (
          <ClassFilterSelect
            value={filters.championClass}
            onChange={(championClass) => onChange({ championClass })}
            classes={availableClasses}
            dataCy='roster-filter-class'
          />
        )}

        {/* Center: rank + ascension */}
        <LabeledSlider
          max={RANK_OPTIONS.length - 1}
          value={optionRange(RANK_OPTIONS, filters.ranks)}
          onChange={(r) => onChange({ ranks: optionSlice(RANK_OPTIONS, r) })}
          format={(i) => RARITY_LABELS[RANK_OPTIONS[i]] ?? RANK_OPTIONS[i]}
          cy='roster-filter-rank'
        />
        <LabeledSlider
          max={ASCENSION_OPTIONS.length - 1}
          value={optionRange(ASCENSION_OPTIONS, filters.ascensions)}
          onChange={(r) => onChange({ ascensions: optionSlice(ASCENSION_OPTIONS, r) })}
          format={(i) => `${f.ascension} ${ASCENSION_OPTIONS[i]}`}
          cy='roster-filter-asc'
        />

        {/* Right: toggles + min sig + reset */}
        {boolToggle('sagaAttacker', f.sagaAttacker, 'roster-filter-saga-attacker')}
        {boolToggle('sagaDefender', f.sagaDefender, 'roster-filter-saga-defender')}
        {boolToggle('preferredAttacker', f.preferred, 'roster-filter-preferred')}
        <LabeledSlider
          max={MAX_SIGNATURE}
          value={[filters.minSignature, filters.maxSignature]}
          onChange={([minSignature, maxSignature]) => onChange({ minSignature, maxSignature })}
          format={(i) => `${f.signature} ${i}`}
          cy='roster-filter-sig'
        />
        {trailing}
        {isFilterActive(filters) && (
          <Button
            type='button'
            variant='outline'
            size='sm'
            className='text-muted-foreground'
            data-cy='roster-filter-reset'
            onClick={onReset}
          >
            {f.reset}
          </Button>
        )}
      </div>
      {showCount && (
        <p
          className='text-xs text-muted-foreground'
          data-cy='roster-filter-count'
        >
          {f.count
            .replace('{filtered}', String(filteredCount))
            .replace('{total}', String(totalCount))}
        </p>
      )}
    </div>
  )
}

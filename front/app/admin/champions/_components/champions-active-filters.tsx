'use client'

import { X } from 'lucide-react'
import { useI18n } from '@/app/i18n'
import type { ChampionFiltersState } from '@/app/admin/_viewmodels/champion-filters'
import {
  CHAMPION_ATTRIBUTE_KEYS,
  useChampionAttributeLabels,
} from '@/app/admin/_viewmodels/champion-attributes'

type ActiveFilterKey = Exclude<keyof ChampionFiltersState, 'search'>

const ACTIVE_FILTER_KEYS: ActiveFilterKey[] = ['championClass', ...CHAMPION_ATTRIBUTE_KEYS]

interface ChampionsActiveFiltersProps {
  filters: ChampionFiltersState
  onClear: (key: ActiveFilterKey) => void
  onClearAll: () => void
}

export default function ChampionsActiveFilters({
  filters,
  onClear,
  onClearAll,
}: Readonly<ChampionsActiveFiltersProps>) {
  const { t } = useI18n()
  const attributeLabels = useChampionAttributeLabels()
  const labels: Record<ActiveFilterKey, string> = {
    championClass: t.champions.classFilter,
    ...attributeLabels,
  }

  function displayValue(key: ActiveFilterKey, value: string) {
    if (key === 'championClass') return value
    return value === 'true' ? t.common.yes : t.common.no
  }

  const active = ACTIVE_FILTER_KEYS.filter((key) => filters[key] !== 'all')

  if (active.length === 0) return null

  return (
    <div className='flex flex-wrap items-center gap-2'>
      {active.map((key) => (
        <button
          key={key}
          type='button'
          onClick={() => onClear(key)}
          data-cy={`champions-active-filter-${key}`}
          className='flex items-center gap-1 rounded-full bg-secondary px-2 py-1 text-xs text-secondary-foreground hover:bg-secondary/80'
        >
          {labels[key]}: {displayValue(key, filters[key])}
          <X className='size-3' />
        </button>
      ))}
      <button
        type='button'
        onClick={onClearAll}
        className='text-xs text-muted-foreground underline hover:text-foreground'
        data-cy='champions-clear-filters'
      >
        {t.champions.clearFilters}
      </button>
    </div>
  )
}

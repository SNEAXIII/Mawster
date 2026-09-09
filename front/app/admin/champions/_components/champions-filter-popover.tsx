'use client'

import { SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useI18n } from '@/app/i18n'
import type { BoolFilter } from '@/app/services/champions'
import type { ChampionFiltersState } from '@/app/admin/_viewmodels/champion-filters'
import {
  CHAMPION_ATTRIBUTES,
  useChampionAttributeLabels,
  type ChampionAttribute,
} from '@/app/admin/_viewmodels/champion-attributes'

interface ChampionsFilterPopoverProps {
  filters: ChampionFiltersState
  activeCount: number
  sagaDisabled?: boolean
  onChange: (key: ChampionAttribute, value: BoolFilter) => void
}

export default function ChampionsFilterPopover({
  filters,
  activeCount,
  sagaDisabled,
  onChange,
}: Readonly<ChampionsFilterPopoverProps>) {
  const { t } = useI18n()
  const labels = useChampionAttributeLabels()

  const choices: { value: BoolFilter; label: string }[] = [
    { value: 'all', label: t.common.all },
    { value: 'true', label: t.common.yes },
    { value: 'false', label: t.common.no },
  ]

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant='outline'
          data-cy='champions-filter-trigger'
        >
          <SlidersHorizontal className='mr-1 size-4' />
          {activeCount > 0 ? `${t.champions.filters} (${activeCount})` : t.champions.filters}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className='w-80'
        align='start'
        data-cy='champions-filter-popover'
      >
        <div className='flex flex-col gap-3'>
          {CHAMPION_ATTRIBUTES.map(({ key, icon, requiresSeason }) => (
            <div
              key={key}
              className='flex items-center justify-between gap-2'
            >
              <span className='flex items-center gap-2 text-sm text-muted-foreground'>
                <img
                  src={icon}
                  alt=''
                  className='size-4 object-contain'
                />
                {labels[key]}
              </span>
              <ToggleGroup
                type='single'
                size='sm'
                value={filters[key]}
                // Radix clears the value when the active item is re-clicked.
                onValueChange={(value) => onChange(key, (value || 'all') as BoolFilter)}
                disabled={sagaDisabled && requiresSeason}
                data-cy={`champions-filter-${key}`}
              >
                {choices.map((choice) => (
                  <ToggleGroupItem
                    key={choice.value}
                    value={choice.value}
                    className='px-2 text-xs'
                    aria-label={choice.label}
                  >
                    {choice.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

'use client'

import DropdownRadioMenu from '@/components/dashboard/pagination/dropdown-radio-menu'
import SeasonSelect from '@/app/components/season-select'
import { SearchInput } from '@/components/search-input'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/app/i18n'
import { championClasses, type BoolFilter } from '@/app/services/champions'
import type { Season } from '@/app/services/season'
import type {
  ChampionAttribute,
  ChampionFiltersState,
} from '@/app/admin/_viewmodels/champion-filters'
import ChampionsFilterPopover from './champions-filter-popover'

interface ChampionsFilterBarProps {
  filters: ChampionFiltersState
  activeCount: number
  canReset: boolean
  seasons: Season[]
  selectedSeasonId: string | null
  sagaDisabled?: boolean
  onSeasonChange: (seasonId: string) => void
  onFilterChange: (key: keyof ChampionFiltersState, value: string) => void
  onReset: () => void
}

export default function ChampionsFilterBar({
  filters,
  activeCount,
  canReset,
  seasons,
  selectedSeasonId,
  sagaDisabled,
  onSeasonChange,
  onFilterChange,
  onReset,
}: Readonly<ChampionsFilterBarProps>) {
  const { t } = useI18n()

  return (
    <div className='flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center'>
      <SearchInput
        placeholder={t.champions.searchPlaceholder}
        value={filters.search}
        onChange={(value) => onFilterChange('search', value)}
        className='w-full sm:w-64'
        data-cy='champion-search'
      />
      <DropdownRadioMenu
        labelButton={t.champions.classFilter}
        labelDescription={t.champions.selectClass}
        possibleValues={championClasses.map((c) => ({ value: c.value, label: c.label }))}
        selectedValue={filters.championClass}
        showSelected
        setValue={(value) => onFilterChange('championClass', value)}
        data-cy='filter-class'
      />
      <SeasonSelect
        seasons={seasons}
        value={selectedSeasonId}
        onChange={onSeasonChange}
        placeholder={t.champions.sagaSeasonPlaceholder}
        getLabel={(s) => t.champions.seasonLabel.replace('{number}', String(s.number))}
        data-cy='admin-saga-season-select'
      />
      <ChampionsFilterPopover
        filters={filters}
        activeCount={activeCount}
        sagaDisabled={sagaDisabled}
        onChange={(key: ChampionAttribute, value: BoolFilter) => onFilterChange(key, value)}
      />
      {canReset && (
        <Button
          variant='ghost'
          size='sm'
          onClick={onReset}
          className='sm:ml-auto'
          data-cy='champions-reset-filters'
        >
          {t.champions.resetFilters}
        </Button>
      )}
    </div>
  )
}

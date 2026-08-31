import { MagnifyingGlassIcon, XCircleIcon } from '@heroicons/react/24/solid'
import ToggleChip from './toggle-chip'
import { ATTRIBUTE_LIST, attributeIcon } from '@/lib/icons'
import { EMPTY_FILTERS, hasActiveFilters, type FilterState } from '@/lib/filters'
import { CHAMPION_CLASSES, type AttributeKey, type ChampionClass } from '@/lib/types'
import type { Dictionary } from '@/i18n/locales'

/** Class chips carry the in-game class colour so they read at a glance. */
const CLASS_ACCENT: Record<ChampionClass, string> = {
  Cosmic: 'data-[on=true]:bg-class-cosmic data-[on=true]:text-black',
  Tech: 'data-[on=true]:bg-class-tech data-[on=true]:text-white',
  Mutant: 'data-[on=true]:bg-class-mutant data-[on=true]:text-black',
  Skill: 'data-[on=true]:bg-class-skill data-[on=true]:text-white',
  Science: 'data-[on=true]:bg-class-science data-[on=true]:text-black',
  Mystic: 'data-[on=true]:bg-class-mystic data-[on=true]:text-white',
}

const FLAG_ACCENT = 'data-[on=true]:bg-primary data-[on=true]:text-primary-foreground'

interface FilterBarProps {
  filters: FilterState
  onChange: (next: FilterState) => void
  iconChoices: Partial<Record<AttributeKey, string>>
  shown: number
  total: number
  t: Dictionary
}

export default function FilterBar({
  filters,
  onChange,
  iconChoices,
  shown,
  total,
  t,
}: Readonly<FilterBarProps>) {
  const toggleIn = <T,>(list: T[], value: T): T[] =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value]

  return (
    <div className='flex flex-col gap-2'>
      <div className='flex items-center gap-2'>
        <div className='relative flex-1'>
          <MagnifyingGlassIcon className='pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
          <input
            value={filters.query}
            onChange={(e) => onChange({ ...filters, query: e.target.value })}
            placeholder={t.search}
            aria-label={t.search}
            className='w-full rounded-md border border-border bg-input py-1.5 pl-8 pr-2 text-sm outline-none placeholder:text-muted-foreground focus:border-ring'
          />
        </div>
        <span className='hidden shrink-0 text-xs text-muted-foreground sm:block'>
          {t.poolCount(shown, total)}
        </span>
        {hasActiveFilters(filters) && (
          <button
            type='button'
            onClick={() => onChange(EMPTY_FILTERS)}
            title={t.clearFilters}
            aria-label={t.clearFilters}
            className='shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground'
          >
            <XCircleIcon className='h-5 w-5' />
          </button>
        )}
      </div>

      <div className='flex flex-wrap items-center gap-1.5'>
        {CHAMPION_CLASSES.map((championClass) => (
          <ToggleChip
            key={championClass}
            on={filters.classes.includes(championClass)}
            onToggle={() =>
              onChange({ ...filters, classes: toggleIn(filters.classes, championClass) })
            }
            accent={CLASS_ACCENT[championClass]}
          >
            {championClass}
          </ToggleChip>
        ))}
      </div>

      <div className='flex flex-wrap items-center gap-1.5'>
        <ToggleChip
          on={filters.ascendable}
          onToggle={() => onChange({ ...filters, ascendable: !filters.ascendable })}
          accent={FLAG_ACCENT}
        >
          {t.ascendableOnly}
        </ToggleChip>
        <ToggleChip
          on={filters.sevenStar}
          onToggle={() => onChange({ ...filters, sevenStar: !filters.sevenStar })}
          accent={FLAG_ACCENT}
        >
          {t.sevenStarOnly}
        </ToggleChip>
        <ToggleChip
          on={filters.prefight}
          onToggle={() => onChange({ ...filters, prefight: !filters.prefight })}
          accent={FLAG_ACCENT}
        >
          {t.prefightOnly}
        </ToggleChip>

        <span
          aria-hidden
          className='mx-1 hidden h-4 w-px bg-border sm:block'
        />

        {ATTRIBUTE_LIST.map((def) => {
          const Icon = attributeIcon(def.key, iconChoices[def.key])
          return (
            <ToggleChip
              key={def.key}
              on={filters.attributes.includes(def.key)}
              onToggle={() =>
                onChange({ ...filters, attributes: toggleIn(filters.attributes, def.key) })
              }
              accent={def.accent}
              title={def.code}
            >
              <Icon className='h-3.5 w-3.5' />
              {def.code}
            </ToggleChip>
          )
        })}
      </div>
    </div>
  )
}

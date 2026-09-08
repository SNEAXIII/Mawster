'use client'

import { useI18n } from '@/app/i18n'
import { SearchInput } from '@/components/search-input'
import { cn } from '@/app/lib/utils'
import { CHAMPION_CLASSES } from '../_lib/types'
import { EMPTY_FILTERS, hasActiveFilters } from '../_lib/filters'
import type { DisplayPrefs } from '../_hooks/use-prefs'
import type { BoardActions } from '../_hooks/use-board'
import type { FilterState } from '../_lib/filters'
import type { BoardState, ChampionClass } from '../_lib/types'

interface TierListHeaderProps {
  board: BoardState
  actions: BoardActions
  prefs: DisplayPrefs
  setPrefs: (patch: Partial<DisplayPrefs>) => void
  filters: FilterState
  onFiltersChange: (filters: FilterState) => void
  shown: number
  total: number
  persistence: { saving: boolean; error: string | null }
}

const CHIP = 'rounded-md border px-2 py-1 text-xs font-semibold transition-colors'

/**
 * Title, save state and the filters. The filters sit above the board because
 * they narrow the rows as well as the pool — they are the page's controls, not
 * the pool's.
 */
export default function TierListHeader({
  board,
  actions,
  prefs,
  setPrefs,
  filters,
  onFiltersChange,
  shown,
  total,
  persistence,
}: Readonly<TierListHeaderProps>) {
  const { t } = useI18n()

  const toggleClass = (championClass: ChampionClass) => {
    const classes = filters.classes.includes(championClass)
      ? filters.classes.filter((entry) => entry !== championClass)
      : [...filters.classes, championClass]
    onFiltersChange({ ...filters, classes })
  }

  return (
    <section className='flex flex-col gap-3'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <input
          value={board.title}
          onChange={(event) => actions.setTitle(event.target.value)}
          placeholder={t.tierlist.boardTitle}
          aria-label={t.tierlist.boardTitle}
          data-cy='tierlist-title'
          className='min-w-48 flex-1 border-none bg-transparent text-lg font-black tracking-tight outline-none sm:text-xl'
        />
        <span
          className='text-xs text-muted-foreground'
          data-cy='tierlist-save-state'
        >
          {persistence.error ?? (persistence.saving ? t.tierlist.saving : t.tierlist.saved)}
        </span>
      </div>

      <div className='flex flex-col gap-3 rounded-lg border bg-card p-3'>
        <div className='flex flex-wrap items-center gap-2'>
          <SearchInput
            value={filters.query}
            onChange={(query: string) => onFiltersChange({ ...filters, query })}
            placeholder={t.tierlist.search}
          />
          <span className='text-xs text-muted-foreground'>
            {t.tierlist.shown.replace('{shown}', String(shown)).replace('{total}', String(total))}
          </span>
        </div>

        <div className='flex flex-wrap gap-1.5'>
          {CHAMPION_CLASSES.map((championClass) => (
            <button
              key={championClass}
              type='button'
              onClick={() => toggleClass(championClass)}
              className={cn(
                CHIP,
                filters.classes.includes(championClass)
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {championClass}
            </button>
          ))}
        </div>

        <div className='flex flex-wrap items-center gap-3 text-xs text-muted-foreground'>
          <label className='flex items-center gap-1.5'>
            <input
              type='checkbox'
              checked={filters.ascendable}
              onChange={(event) =>
                onFiltersChange({ ...filters, ascendable: event.target.checked })
              }
            />
            {t.tierlist.ascendableOnly}
          </label>
          <label className='flex items-center gap-1.5'>
            <input
              type='checkbox'
              checked={filters.prefight}
              onChange={(event) => onFiltersChange({ ...filters, prefight: event.target.checked })}
            />
            {t.tierlist.prefightOnly}
          </label>
          <label className='flex items-center gap-1.5'>
            <input
              type='checkbox'
              checked={filters.saga}
              onChange={(event) => onFiltersChange({ ...filters, saga: event.target.checked })}
            />
            {t.tierlist.sagaOnly}
          </label>
          <label className='flex items-center gap-1.5'>
            <input
              type='checkbox'
              checked={prefs.showNames}
              onChange={(event) => setPrefs({ showNames: event.target.checked })}
            />
            {t.tierlist.showNames}
          </label>
          <label className='flex items-center gap-1.5'>
            <input
              type='checkbox'
              checked={prefs.showBadges}
              onChange={(event) => setPrefs({ showBadges: event.target.checked })}
            />
            {t.tierlist.showBadges}
          </label>
          {hasActiveFilters(filters) && (
            <button
              type='button'
              onClick={() => onFiltersChange(EMPTY_FILTERS)}
              className='underline hover:text-foreground'
            >
              {t.tierlist.clearFilters}
            </button>
          )}
        </div>
      </div>
    </section>
  )
}

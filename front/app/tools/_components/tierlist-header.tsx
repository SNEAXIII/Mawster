'use client'

import { useI18n } from '@/app/i18n'
import { cn } from '@/app/lib/utils'
import { SearchInput } from '@/components/search-input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import SelectorFilterBar, { type ToggleConfig } from '@/app/game/_components/selector-filter-bar'
import { CHAMPION_CLASSES } from '../_lib/types'
import { EMPTY_FILTERS, hasActiveFilters } from '../_lib/filters'
import { TAG_DISPLAY, TAG_ICON } from '../_lib/tags'
import { TAG_KEYS } from '../_lib/types'
import type { DisplayPrefs } from '../_hooks/use-prefs'
import type { BoardActions } from '../_hooks/use-board'
import type { FilterState, RarityFilter } from '../_lib/filters'
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

  const toggles: ToggleConfig[] = [
    {
      key: 'ascendable',
      label: t.tierlist.ascendableOnly,
      active: filters.ascendable,
      onToggle: (ascendable) => onFiltersChange({ ...filters, ascendable }),
    },
    {
      key: 'saga-attacker',
      label: t.tierlist.sagaAttackerOnly,
      active: filters.sagaAttacker,
      onToggle: (sagaAttacker) => onFiltersChange({ ...filters, sagaAttacker }),
    },
    {
      key: 'saga-defender',
      label: t.tierlist.sagaDefenderOnly,
      active: filters.sagaDefender,
      onToggle: (sagaDefender) => onFiltersChange({ ...filters, sagaDefender }),
    },
    // Display preferences, not filters — but they belong to the same row of
    // controls, and splitting them into a second bar reads as clutter.
    {
      key: 'names',
      label: t.tierlist.showNames,
      active: prefs.showNames,
      onToggle: (showNames) => setPrefs({ showNames }),
    },
    {
      key: 'badges',
      label: t.tierlist.showBadges,
      active: prefs.showBadges,
      onToggle: (showBadges) => setPrefs({ showBadges }),
    },
  ]

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
            data-cy='tierlist-search'
          />
          <Select
            value={filters.rarity}
            onValueChange={(rarity) =>
              onFiltersChange({ ...filters, rarity: rarity as RarityFilter })
            }
          >
            <SelectTrigger
              className='w-36'
              data-cy='tierlist-rarity-filter'
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>{t.tierlist.rarityAll}</SelectItem>
              <SelectItem value='7'>{t.tierlist.raritySeven}</SelectItem>
              <SelectItem value='6'>{t.tierlist.raritySix}</SelectItem>
            </SelectContent>
          </Select>
          <span className='text-xs text-muted-foreground'>
            {t.tierlist.shown.replace('{shown}', String(shown)).replace('{total}', String(total))}
          </span>
        </div>

        {/* Tag filters, in the same glyphs the cards wear: a champion has to
            carry every tag picked here to stay in the pool. */}
        <div className='flex flex-wrap gap-1.5'>
          {TAG_KEYS.map((key) => {
            const active = filters.tags.includes(key)
            return (
              <button
                key={key}
                type='button'
                title={t.tierlist.tags[key]}
                data-cy={`tierlist-filter-tag-${key}`}
                onClick={() =>
                  onFiltersChange({
                    ...filters,
                    tags: active
                      ? filters.tags.filter((entry) => entry !== key)
                      : [...filters.tags, key],
                  })
                }
                className={cn(
                  'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-bold transition-colors',
                  active
                    ? `${TAG_DISPLAY[key].tone} border-transparent`
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <img
                  src={TAG_ICON[key]}
                  alt=''
                  className='size-4'
                />
                {TAG_DISPLAY[key].code}
              </button>
            )
          })}
        </div>

        <SelectorFilterBar
          classes={[...CHAMPION_CLASSES]}
          // The bar picks one class at a time, so the list holds at most one.
          classFilter={filters.classes[0] ?? ''}
          onClassChange={(value) =>
            onFiltersChange({
              ...filters,
              classes: value ? [value as ChampionClass] : [],
            })
          }
          toggles={toggles}
          canReset={hasActiveFilters(filters)}
          onReset={() => onFiltersChange(EMPTY_FILTERS)}
        />
      </div>
    </section>
  )
}

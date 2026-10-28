'use client'

import type { ReactNode } from 'react'
import { Check, Clock, Loader2, X } from 'lucide-react'
import { FiTrash2 } from 'react-icons/fi'
import { useI18n } from '@/app/i18n'
import { Button } from '@/components/ui/button'
import LabeledSlider from '@/components/labeled-slider'
import ChampionPortrait from '@/components/champion-portrait'
import type { Champion } from '@/app/services/champions'
import { RARITIES, RARITY_LABELS } from '@/app/services/roster'
import { cn } from '@/app/lib/utils'
import { rarityBadgeClass } from '@/app/game/defense/_components/defense-utils'
import ChampionFilterSelect from '@/app/game/knowledge-base/_components/champion-filter-select'
import { widen, type Draft, type Range } from './quick-edit-logic'
import type { SaveState } from './use-quick-edit-saves'

const STATE_ICONS: Record<SaveState, ReactNode> = {
  pending: <Clock className='size-4 text-muted-foreground' />,
  saving: <Loader2 className='size-4 animate-spin text-muted-foreground' />,
  saved: <Check className='size-4 text-green-500' />,
  error: <X className='size-4 text-destructive' />,
}

interface QuickEditRowProps {
  node: number
  value: Draft | null
  champion?: Champion
  ascendable: boolean
  locked: boolean
  saveState?: SaveState
  rankRange: Range
  onPickChampion: (championId: string | null) => void
  onEdit: (draft: Draft) => void
  onRemove: () => void
}

export default function QuickEditRow({
  node,
  value,
  champion,
  ascendable,
  locked,
  saveState,
  rankRange,
  onPickChampion,
  onEdit,
  onRemove,
}: Readonly<QuickEditRowProps>) {
  const { t } = useI18n()
  const q = t.game.war.quickEdit
  const rankBounds = widen(rankRange, value?.rankIndex ?? rankRange[0])
  const rarity = value ? RARITIES[value.rankIndex] : null
  const ascension = value && ascendable ? value.ascension : 0

  return (
    <fieldset
      disabled={locked}
      className='flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border py-2 disabled:opacity-50'
      data-cy={`war-quick-edit-row-${node}`}
    >
      <span className='w-5 shrink-0 font-mono text-sm tabular-nums'>#{node}</span>
      {/* Fixed-size slot so rows stay aligned whether a champion is picked or not. */}
      <span
        className='size-10 shrink-0'
        data-cy={`war-quick-edit-portrait-${node}`}
      >
        {rarity && champion && (
          <ChampionPortrait
            imageUrl={champion.image_url}
            name={champion.name}
            rarity={rarity}
            size={40}
          />
        )}
      </span>
      <span className='flex w-6 shrink-0 flex-col text-xs font-semibold leading-tight tabular-nums'>
        {rarity && (
          <span
            className={rarityBadgeClass(rarity)}
            data-cy={`war-quick-edit-rarity-${node}`}
          >
            {RARITY_LABELS[rarity]}
          </span>
        )}
        {ascension > 0 && (
          <span
            className='text-purple-400'
            data-cy={`war-quick-edit-ascension-${node}`}
          >
            A{ascension}
          </span>
        )}
      </span>
      <ChampionFilterSelect
        value={value?.championId ?? null}
        onChange={onPickChampion}
        placeholder={q.empty}
        clearLabel={q.empty}
        data-cy={`war-quick-edit-champion-${node}`}
      />
      <LabeledSlider
        min={rankBounds[0]}
        max={rankBounds[1]}
        value={[value?.rankIndex ?? rankRange[0]]}
        onChange={([rankIndex]) => value && onEdit({ ...value, rankIndex })}
        format={(i) => RARITY_LABELS[RARITIES[i]]}
        cy={`war-quick-edit-rank-${node}`}
        disabled={locked || !value}
        className='w-28'
        title={t.game.war.rarity}
      />
      {/* Hidden, not removed, so the columns of every row stay aligned. */}
      <LabeledSlider
        max={2}
        value={[ascension]}
        onChange={([next]) => value && onEdit({ ...value, ascension: next })}
        format={(a) => (a === 0 ? t.game.war.ascensionNone : `A${a}`)}
        cy={`war-quick-edit-asc-${node}`}
        disabled={locked || !value || !ascendable}
        className={cn('w-28', (!value || !ascendable) && 'invisible')}
        title={t.game.war.ascension}
      />
      <span
        className='flex size-5 shrink-0 items-center justify-center'
        title={saveState && q.states[saveState]}
        data-cy={`war-quick-edit-status-${node}`}
        data-state={saveState ?? ''}
      >
        {saveState && STATE_ICONS[saveState]}
      </span>
      <span className='size-8 shrink-0'>
        {value && !locked && (
          <Button
            variant='ghost'
            size='icon'
            onClick={onRemove}
            aria-label={q.remove}
            title={q.remove}
            data-cy={`war-quick-edit-remove-${node}`}
          >
            <FiTrash2 />
          </Button>
        )}
      </span>
    </fieldset>
  )
}

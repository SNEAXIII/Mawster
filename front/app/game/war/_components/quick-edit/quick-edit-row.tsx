'use client'

import type { ReactNode } from 'react'
import { Check, Clock, Loader2, X } from 'lucide-react'
import { FiTrash2 } from 'react-icons/fi'
import { useI18n } from '@/app/i18n'
import { Button } from '@/components/ui/button'
import LabeledSlider from '@/components/labeled-slider'
import { RARITIES, RARITY_LABELS } from '@/app/services/roster'
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
  ascendable: boolean
  locked: boolean
  saveState?: SaveState
  rankRange: Range
  ascRange: Range
  onPickChampion: (championId: string | null) => void
  onEdit: (draft: Draft) => void
  onRemove: () => void
}

export default function QuickEditRow({
  node,
  value,
  ascendable,
  locked,
  saveState,
  rankRange,
  ascRange,
  onPickChampion,
  onEdit,
  onRemove,
}: Readonly<QuickEditRowProps>) {
  const { t } = useI18n()
  const q = t.game.war.quickEdit
  const rankBounds = widen(rankRange, value?.rankIndex ?? rankRange[0])
  const ascBounds = widen(ascRange, value?.ascension ?? ascRange[0])
  const sliderTitle = (label: string) => (
    <span className='text-xs text-muted-foreground'>{label}</span>
  )

  return (
    <fieldset
      disabled={locked}
      className='flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border py-2 disabled:opacity-50'
      data-cy={`war-quick-edit-row-${node}`}
    >
      <span className='w-10 font-mono text-sm tabular-nums'>#{node}</span>
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
        title={sliderTitle(t.game.war.rarity)}
      />
      <LabeledSlider
        min={ascBounds[0]}
        max={ascBounds[1]}
        value={[value?.ascension ?? ascRange[0]]}
        onChange={([ascension]) => value && onEdit({ ...value, ascension })}
        format={(a) => (a === 0 ? t.game.war.ascensionNone : `A${a}`)}
        cy={`war-quick-edit-asc-${node}`}
        disabled={locked || !value || !ascendable}
        className='w-28'
        title={sliderTitle(t.game.war.ascension)}
      />
      <span
        className='flex size-5 items-center justify-center'
        title={saveState && q.states[saveState]}
        data-cy={`war-quick-edit-status-${node}`}
        data-state={saveState ?? ''}
      >
        {saveState && STATE_ICONS[saveState]}
      </span>
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
    </fieldset>
  )
}

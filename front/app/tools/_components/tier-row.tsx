'use client'

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable'
import { ChevronDown, ChevronUp, Trash2, X } from 'lucide-react'
import { useI18n } from '@/app/i18n'
import { cn } from '@/app/lib/utils'
import ChampionCard from './champion-card'
import { tagsOf } from '../_lib/board'
import { readableTextColor } from '../_lib/color'
import type { BoardActions } from '../_hooks/use-board'
import type { BoardState, BoardTier, CatalogChampion } from '../_lib/types'

interface TierRowProps {
  tier: BoardTier
  /** Champions of this row that pass the current filters, in board order. */
  visibleIds: string[]
  board: BoardState
  byId: Map<string, CatalogChampion>
  actions: BoardActions
  cardSize: number
  showNames: boolean
  showBadges: boolean
  canRemove: boolean
  /** True while the board is being captured: controls come out of the picture. */
  exporting: boolean
  isFirst: boolean
  isLast: boolean
  onOpenChampion: (championId: string) => void
}

const CONTROL = 'rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-25'

export default function TierRow({
  tier,
  visibleIds,
  board,
  byId,
  actions,
  cardSize,
  showNames,
  showBadges,
  canRemove,
  exporting,
  isFirst,
  isLast,
  onOpenChampion,
}: Readonly<TierRowProps>) {
  const { t } = useI18n()
  const { setNodeRef, isOver } = useDroppable({ id: tier.id })

  return (
    <div
      className='flex items-stretch overflow-hidden rounded-lg border bg-card'
      data-cy={`tierlist-row-${tier.label}`}
    >
      {/* Label block — the colour swatch doubles as the rename field. */}
      <div
        className='flex w-16 shrink-0 flex-col items-center justify-center gap-1 p-1 sm:w-24'
        style={{ backgroundColor: tier.color }}
      >
        {exporting ? (
          <span
            className='w-full text-center text-lg font-black sm:text-2xl'
            style={{ color: readableTextColor(tier.color) }}
          >
            {tier.label}
          </span>
        ) : (
          <>
            <input
              value={tier.label}
              onChange={(event) => actions.updateTier(tier.id, { label: event.target.value })}
              aria-label={t.tierlist.tierLabel}
              data-cy='tierlist-row-label'
              className='w-full border-none bg-transparent text-center text-lg font-black outline-none sm:text-2xl'
              style={{ color: readableTextColor(tier.color) }}
            />
            <input
              type='color'
              value={tier.color}
              onChange={(event) => actions.updateTier(tier.id, { color: event.target.value })}
              aria-label={t.tierlist.tierColor}
              className='h-4 w-8 cursor-pointer rounded'
            />
          </>
        )}
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          'flex min-h-22 flex-1 flex-wrap content-start items-start gap-1 p-2 transition-colors',
          isOver && 'bg-primary/10'
        )}
      >
        <SortableContext
          items={visibleIds}
          strategy={rectSortingStrategy}
        >
          {visibleIds.map((id) => {
            const champion = byId.get(id)
            if (!champion) return null
            return (
              <ChampionCard
                key={id}
                champion={champion}
                tags={tagsOf(board, id)}
                size={cardSize}
                showName={showNames}
                showBadges={showBadges}
                onOpen={onOpenChampion}
              />
            )
          })}
        </SortableContext>
        {visibleIds.length === 0 && !exporting && (
          <span className='self-center px-2 text-xs text-muted-foreground'>
            {tier.championIds.length === 0
              ? t.tierlist.emptyTier
              : t.tierlist.hiddenByFilters.replace('{count}', String(tier.championIds.length))}
          </span>
        )}
      </div>

      {!exporting && (
        <div className='flex w-8 shrink-0 flex-col items-center justify-center gap-1 border-l bg-muted'>
          <button
            type='button'
            onClick={() => actions.moveTier(tier.id, -1)}
            disabled={isFirst}
            title={t.tierlist.moveUp}
            aria-label={t.tierlist.moveUp}
            className={CONTROL}
          >
            <ChevronUp className='size-4' />
          </button>
          <button
            type='button'
            onClick={() => actions.clearTier(tier.id)}
            disabled={tier.championIds.length === 0}
            title={t.tierlist.clearTier}
            aria-label={t.tierlist.clearTier}
            className={CONTROL}
          >
            <X className='size-4' />
          </button>
          <button
            type='button'
            onClick={() => actions.removeTier(tier.id)}
            disabled={!canRemove}
            title={t.tierlist.removeTier}
            aria-label={t.tierlist.removeTier}
            data-cy='tierlist-row-remove'
            className={cn(CONTROL, 'hover:text-destructive')}
          >
            <Trash2 className='size-4' />
          </button>
          <button
            type='button'
            onClick={() => actions.moveTier(tier.id, 1)}
            disabled={isLast}
            title={t.tierlist.moveDown}
            aria-label={t.tierlist.moveDown}
            className={CONTROL}
          >
            <ChevronDown className='size-4' />
          </button>
        </div>
      )}
    </div>
  )
}

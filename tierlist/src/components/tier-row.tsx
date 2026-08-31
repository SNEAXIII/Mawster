import { useDroppable } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable'
import { ChevronDownIcon, ChevronUpIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/solid'
import ChampionCard from './champion-card'
import { CHAMPIONS_BY_ID } from '@/data/champions'
import { attributesOf } from '@/lib/board'
import { readableTextColor } from '@/lib/color'
import { cn } from '@/lib/cn'
import type { BoardActions } from '@/lib/use-board'
import type { Dictionary } from '@/i18n/locales'
import type { BoardState, Tier } from '@/lib/types'

interface TierRowProps {
  tier: Tier
  board: BoardState
  actions: BoardActions
  t: Dictionary
  cardSize: number
  showNames: boolean
  showBadges: boolean
  exporting: boolean
  canRemove: boolean
  isFirst: boolean
  isLast: boolean
  onOpenChampion: (championId: string) => void
}

export default function TierRow({
  tier,
  board,
  actions,
  t,
  cardSize,
  showNames,
  showBadges,
  exporting,
  canRemove,
  isFirst,
  isLast,
  onOpenChampion,
}: Readonly<TierRowProps>) {
  const { setNodeRef, isOver } = useDroppable({ id: tier.id })
  const labelColor = readableTextColor(tier.color)

  return (
    <div className='flex items-stretch overflow-hidden rounded-lg border border-border bg-card'>
      {/* Label block — the colour swatch doubles as the rename field. */}
      <div
        className='flex w-16 shrink-0 flex-col items-center justify-center gap-1 p-1 sm:w-24'
        style={{ backgroundColor: tier.color }}
      >
        <input
          value={tier.label}
          onChange={(e) => actions.updateTier(tier.id, { label: e.target.value })}
          aria-label={t.tierLabel}
          className='w-full border-none bg-transparent text-center text-lg font-black outline-none sm:text-2xl'
          style={{ color: labelColor }}
        />
        <input
          type='color'
          value={tier.color}
          onChange={(e) => actions.updateTier(tier.id, { color: e.target.value })}
          aria-label={t.tierColor}
          data-export-hide
          className='h-4 w-8 cursor-pointer rounded'
        />
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex min-h-[5.5rem] flex-1 flex-wrap content-start items-start gap-1 p-2 transition-colors',
          isOver && 'bg-primary/10'
        )}
      >
        <SortableContext
          items={tier.championIds}
          strategy={rectSortingStrategy}
        >
          {tier.championIds.map((id) => {
            const champion = CHAMPIONS_BY_ID.get(id)
            if (!champion) return null
            return (
              <ChampionCard
                key={id}
                champion={champion}
                attributes={attributesOf(board, id)}
                iconChoices={board.iconChoices}
                size={cardSize}
                frame={board.frame}
                showName={showNames}
                showBadges={showBadges}
                exporting={exporting}
                onOpen={onOpenChampion}
              />
            )
          })}
        </SortableContext>
        {tier.championIds.length === 0 && (
          <span
            data-export-hide
            className='self-center px-2 text-xs text-muted-foreground'
          >
            {t.emptyTier}
          </span>
        )}
      </div>

      {/* Row controls */}
      <div
        data-export-hide
        className='flex w-8 shrink-0 flex-col items-center justify-center gap-1 border-l border-border bg-elevated'
      >
        <button
          type='button'
          onClick={() => actions.moveTier(tier.id, -1)}
          disabled={isFirst}
          title={t.moveUp}
          aria-label={t.moveUp}
          className='rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-25'
        >
          <ChevronUpIcon className='h-4 w-4' />
        </button>
        <button
          type='button'
          onClick={() => actions.clearTier(tier.id)}
          disabled={tier.championIds.length === 0}
          title={t.clearTier}
          aria-label={t.clearTier}
          className='rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-25'
        >
          <XMarkIcon className='h-4 w-4' />
        </button>
        <button
          type='button'
          onClick={() => actions.removeTier(tier.id)}
          disabled={!canRemove}
          title={t.removeTier}
          aria-label={t.removeTier}
          className='rounded p-1 text-muted-foreground hover:text-destructive disabled:opacity-25'
        >
          <TrashIcon className='h-4 w-4' />
        </button>
        <button
          type='button'
          onClick={() => actions.moveTier(tier.id, 1)}
          disabled={isLast}
          title={t.moveDown}
          aria-label={t.moveDown}
          className='rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-25'
        >
          <ChevronDownIcon className='h-4 w-4' />
        </button>
      </div>
    </div>
  )
}

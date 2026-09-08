'use client'

import { useEffect, useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable'
import { ChevronDown, ChevronUp, Trash2, X } from 'lucide-react'
import { ConfirmationDialog } from '@/components/confirmation-dialog'
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

/** Both star frames share this ratio (212x174), so a card is shorter than it is wide. */
const FRAME_ASPECT = 212 / 174
/** The `p-2` above and below, in px. */
const ROW_PADDING = 16

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
  // One slot rather than a flag each: only ever one dialog is open.
  const [confirming, setConfirming] = useState<'clear' | 'remove' | null>(null)

  /**
   * The colour being dragged in the picker, kept out of the board.
   *
   * A colour input fires on every pointer move, and each one would rebuild the
   * board, re-filter the whole catalog and re-render the pool — three frames a
   * second while dragging. The row previews the draft; the board only hears
   * about it when the picker closes.
   */
  const [draftColor, setDraftColor] = useState(tier.color)
  useEffect(() => setDraftColor(tier.color), [tier.color])

  // Committed shortly after the dragging stops rather than on blur alone: the
  // native picker does not blur the input when it closes, so a colour picked and
  // left alone would never reach the board.
  useEffect(() => {
    if (draftColor === tier.color) return
    const timer = setTimeout(() => actions.updateTier(tier.id, { color: draftColor }), 200)
    return () => clearTimeout(timer)
  }, [draftColor, tier.color, tier.id, actions])

  return (
    <div
      className='flex items-stretch overflow-hidden rounded-lg border bg-card'
      data-cy={`tierlist-row-${tier.label}`}
    >
      {/* Label block — the colour swatch doubles as the rename field. */}
      <div
        className='flex w-16 shrink-0 flex-col items-center justify-center gap-1 p-1 sm:w-24'
        style={{ backgroundColor: draftColor }}
      >
        {exporting ? (
          <span
            className='w-full text-center text-lg font-black sm:text-2xl'
            style={{ color: readableTextColor(draftColor) }}
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
              style={{ color: readableTextColor(draftColor) }}
            />
            <input
              type='color'
              value={draftColor}
              onChange={(event) => setDraftColor(event.target.value)}
              aria-label={t.tierlist.tierColor}
              // The browser paints a white box with its own padding around the
              // swatch; at this size that is all one sees. Stripped so the chip
              // is the colour itself.
              className='h-4 w-8 cursor-pointer appearance-none rounded border-0 bg-transparent p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded [&::-webkit-color-swatch]:border-0'
            />
          </>
        )}
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          'flex flex-1 flex-wrap content-center items-center gap-2 p-2 transition-colors',
          // Loud on purpose: over a dark board a 10% tint is invisible, and the
          // one question a drag has to answer is "will it land here".
          isOver && 'bg-primary/25 inset-ring-2 inset-ring-primary'
        )}
        // A row is as tall as the cards it holds, not a fixed block: the star
        // frame is wider than it is tall (212x174), so the height follows the
        // card size rather than a rem value that stops matching as it changes.
        style={{ minHeight: Math.round(cardSize / FRAME_ASPECT) + ROW_PADDING }}
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
        {visibleIds.length === 0 && !exporting && !isOver && (
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
            onClick={() => setConfirming('clear')}
            disabled={tier.championIds.length === 0}
            title={t.tierlist.clearTier}
            aria-label={t.tierlist.clearTier}
            className={CONTROL}
          >
            <X className='size-4' />
          </button>
          <button
            type='button'
            onClick={() => setConfirming('remove')}
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

      <ConfirmationDialog
        open={confirming !== null}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={confirming === 'remove' ? t.tierlist.removeTier : t.tierlist.clearTier}
        description={
          confirming === 'remove'
            ? t.tierlist.removeTierConfirm.replace('{label}', tier.label)
            : t.tierlist.clearTierConfirm
                .replace('{label}', tier.label)
                .replace('{count}', String(tier.championIds.length))
        }
        onConfirm={() => {
          if (confirming === 'remove') actions.removeTier(tier.id)
          else actions.clearTier(tier.id)
          setConfirming(null)
        }}
      />
    </div>
  )
}

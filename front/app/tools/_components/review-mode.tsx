'use client'

import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, CheckCircle2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/app/i18n'
import ReviewCard from './review-card'
import { tagsOf } from '../_lib/board'
import type { BoardActions } from '../_hooks/use-board'
import type { BoardState, CatalogChampion } from '../_lib/types'

/** Digit shortcuts only reach this many rows; beyond that, click. */
const HOTKEY_LIMIT = 9

interface ReviewModeProps {
  /** Queue snapshot, taken when the run started — filters cannot reshuffle it. */
  championIds: string[]
  byId: Map<string, CatalogChampion>
  board: BoardState
  actions: BoardActions
  onClose: () => void
}

/**
 * One champion at a time, in the order the filtered pool showed them: pick a row
 * and it advances. Built for ranking a whole class in one sitting, where
 * dragging sixty cards one by one is the slow way round.
 *
 * The queue is a snapshot on purpose. Assigning a champion takes it out of the
 * pool, so a live query would renumber the run under the user's fingers.
 */
export default function ReviewMode({
  championIds,
  byId,
  board,
  actions,
  onClose,
}: Readonly<ReviewModeProps>) {
  const { t } = useI18n()
  const total = championIds.length
  const [index, setIndex] = useState(0)
  const [placed, setPlaced] = useState<Record<string, string>>({})
  const [skipped, setSkipped] = useState<Set<string>>(() => new Set())

  const done = index >= total

  const assign = useCallback(
    (tierId: string) => {
      const championId = championIds[index]
      if (!championId) return
      actions.moveChampion(championId, tierId)
      setPlaced((current) => ({ ...current, [championId]: tierId }))
      setIndex((current) => Math.min(current + 1, total))
    },
    [actions, championIds, index, total]
  )

  const skip = useCallback(() => {
    const championId = championIds[index]
    if (championId) setSkipped((current) => new Set(current).add(championId))
    setIndex((current) => Math.min(current + 1, total))
  }, [championIds, index, total])

  const back = useCallback(() => setIndex((current) => Math.max(current - 1, 0)), [])

  const champion = done ? undefined : byId.get(championIds[index])
  const currentTierId = champion
    ? board.tiers.find((tier) => tier.championIds.includes(champion.id))?.id
    : undefined

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // Never steal keys from the signature field or a row rename.
      if (event.target instanceof HTMLInputElement) return
      if (event.key === 'Escape') return onClose()
      if (done) return
      if (event.key === 'ArrowLeft') return back()
      if (event.key === 'ArrowRight' || event.key.toLowerCase() === 's') return skip()
      const digit = Number(event.key)
      if (digit >= 1 && digit <= Math.min(HOTKEY_LIMIT, board.tiers.length)) {
        assign(board.tiers[digit - 1].id)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [assign, back, skip, onClose, done, board.tiers])

  const placedCount = Object.keys(placed).length
  const progress = total === 0 ? 0 : (Math.min(index, total) / total) * 100

  return (
    <div
      className='fixed inset-0 z-50 flex flex-col bg-background'
      data-cy='tierlist-review'
    >
      <header className='flex shrink-0 items-center gap-3 border-b px-4 py-3'>
        <span className='text-sm font-bold tabular-nums'>
          {Math.min(index + 1, total)} / {total}
        </span>
        <div className='h-1.5 flex-1 overflow-hidden rounded-full bg-muted'>
          <div
            className='h-full rounded-full bg-primary transition-[width]'
            style={{ width: `${progress}%` }}
          />
        </div>
        <button
          type='button'
          onClick={onClose}
          aria-label={t.tierlist.quit}
          title={t.tierlist.quit}
          data-cy='review-quit'
          className='rounded p-1 text-muted-foreground hover:text-foreground'
        >
          <X className='size-5' />
        </button>
      </header>

      {champion ? (
        // `m-auto` inside rather than `justify-center`: a centred flex scroll
        // container clips its own top once the content is taller than the screen.
        <div className='flex flex-1 overflow-y-auto'>
          <ReviewCard
            champion={champion}
            tags={tagsOf(board, champion.id)}
            tiers={board.tiers}
            currentTierId={currentTierId}
            actions={actions}
            onAssign={assign}
          />
        </div>
      ) : (
        <div className='flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center'>
          <CheckCircle2 className='size-14 text-primary' />
          <h2 className='text-xl font-black'>{t.tierlist.reviewDone}</h2>
          <p className='text-sm text-muted-foreground'>
            {t.tierlist.reviewSummary
              .replace('{placed}', String(placedCount))
              .replace('{total}', String(total))}
          </p>
          <div className='flex gap-2'>
            {total > 0 && (
              <Button
                variant='outline'
                onClick={back}
              >
                {t.tierlist.previous}
              </Button>
            )}
            <Button
              onClick={onClose}
              data-cy='review-close'
            >
              {t.tierlist.close}
            </Button>
          </div>
        </div>
      )}

      <footer className='flex shrink-0 items-center justify-between gap-2 border-t px-4 py-3'>
        <Button
          variant='outline'
          size='sm'
          onClick={back}
          disabled={index === 0}
        >
          <ArrowLeft className='size-4' />
          {t.tierlist.previous}
        </Button>
        <span className='text-xs text-muted-foreground tabular-nums'>
          {t.tierlist.reviewPlaced.replace('{count}', String(placedCount))} ·{' '}
          {t.tierlist.reviewSkipped.replace('{count}', String(skipped.size))}
        </span>
        <Button
          variant='outline'
          size='sm'
          onClick={skip}
          disabled={done}
          data-cy='review-skip'
        >
          {t.tierlist.skip}
          <ArrowRight className='size-4' />
        </Button>
      </footer>
    </div>
  )
}

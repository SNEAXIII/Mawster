import { useDroppable } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable'
import ChampionCard from './champion-card'
import { POOL_ID } from '@/lib/use-board'
import { attributesOf } from '@/lib/board'
import { cn } from '@/lib/cn'
import type { BoardState, Champion } from '@/lib/types'
import type { Dictionary } from '@/i18n/locales'

interface ChampionPoolProps {
  champions: Champion[]
  board: BoardState
  cardSize: number
  showNames: boolean
  showBadges: boolean
  t: Dictionary
  onOpenChampion: (championId: string) => void
}

/**
 * Every champion not placed in a tier, after filtering. Also the drop target
 * that sends a ranked champion back — dropping here just detaches it, the pool
 * order always follows the champion list.
 */
export default function ChampionPool({
  champions,
  board,
  cardSize,
  showNames,
  showBadges,
  t,
  onOpenChampion,
}: Readonly<ChampionPoolProps>) {
  const { setNodeRef, isOver } = useDroppable({ id: POOL_ID })
  const ids = champions.map((c) => c.id)

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex min-h-[6rem] flex-wrap content-start gap-1 rounded-lg border border-border bg-card p-2 transition-colors',
        isOver && 'bg-primary/10'
      )}
    >
      <SortableContext
        items={ids}
        strategy={rectSortingStrategy}
      >
        {champions.map((champion) => (
          <div
            key={champion.id}
            className='pool-card'
          >
            <ChampionCard
              champion={champion}
              attributes={attributesOf(board, champion.id)}
              iconChoices={board.iconChoices}
              size={cardSize}
              frame={board.frame}
              showName={showNames}
              showBadges={showBadges}
              onOpen={onOpenChampion}
            />
          </div>
        ))}
      </SortableContext>
      {champions.length === 0 && (
        <p className='w-full py-6 text-center text-sm text-muted-foreground'>{t.noMatch}</p>
      )}
    </div>
  )
}

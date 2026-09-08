'use client'

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable'
import { useI18n } from '@/app/i18n'
import { cn } from '@/app/lib/utils'
import ChampionCard from './champion-card'
import { POOL_ID } from '../_hooks/use-board'
import { tagsOf } from '../_lib/board'
import type { StarMode } from '../_hooks/use-prefs'
import type { BoardState, CatalogChampion } from '../_lib/types'

interface ChampionPoolProps {
  champions: CatalogChampion[]
  board: BoardState
  cardSize: number
  showNames: boolean
  showBadges: boolean
  starMode: StarMode
  onOpenChampion: (championId: string) => void
}

/**
 * Every champion not placed in a row, after filtering. Also the drop target that
 * sends a ranked champion back — dropping here only detaches it, the pool order
 * always follows the catalog.
 */
export default function ChampionPool({
  champions,
  board,
  cardSize,
  showNames,
  showBadges,
  starMode,
  onOpenChampion,
}: Readonly<ChampionPoolProps>) {
  const { t } = useI18n()
  const { setNodeRef, isOver } = useDroppable({ id: POOL_ID })

  return (
    <div
      ref={setNodeRef}
      data-cy='tierlist-pool'
      className={cn(
        'flex min-h-24 flex-wrap content-start gap-2 rounded-lg border bg-card p-3 transition-colors',
        isOver && 'bg-primary/10'
      )}
    >
      <SortableContext
        items={champions.map((champion) => champion.id)}
        strategy={rectSortingStrategy}
      >
        {champions.map((champion) => (
          <ChampionCard
            key={champion.id}
            champion={champion}
            tags={tagsOf(board, champion.id)}
            size={cardSize}
            showName={showNames}
            showBadges={showBadges}
            starMode={starMode}
            onOpen={onOpenChampion}
          />
        ))}
      </SortableContext>
      {champions.length === 0 && (
        <p className='w-full py-6 text-center text-sm text-muted-foreground'>
          {t.tierlist.noMatch}
        </p>
      )}
    </div>
  )
}

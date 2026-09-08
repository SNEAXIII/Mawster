'use client'

import { useCallback, useMemo, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { Plus } from 'lucide-react'
import { useI18n } from '@/app/i18n'
import ChampionPool from './_components/champion-pool'
import ChampionSheet from './_components/champion-sheet'
import TierRow from './_components/tier-row'
import { ChampionCardVisual } from './_components/champion-card'
import TierListHeader from './_components/tierlist-header'
import { POOL_ID, useBoard } from './_hooks/use-board'
import { useBoardPersistence } from './_hooks/use-board-persistence'
import { useCatalog } from './_hooks/use-catalog'
import { usePrefs } from './_hooks/use-prefs'
import { rankedIds, tagsOf } from './_lib/board'
import { EMPTY_FILTERS, matchesFilters } from './_lib/filters'
import type { FilterState } from './_lib/filters'

export default function TierListPage() {
  const { t } = useI18n()
  const catalog = useCatalog()
  const { board, setBoard, actions } = useBoard()
  const persistence = useBoardPersistence(board, setBoard, catalog.knownIds, !catalog.loading)
  const [prefs, setPrefs] = usePrefs()
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS)
  const [openChampionId, setOpenChampionId] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)

  const sensors = useSensors(
    // The mouse needs a small threshold so a plain click still opens the sheet;
    // touch uses a long press instead, which leaves scrolling over the pool intact.
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const ranked = useMemo(() => rankedIds(board), [board])
  const poolChampions = useMemo(
    () =>
      catalog.champions.filter(
        (champion) => !ranked.has(champion.id) && matchesFilters(champion, filters, board)
      ),
    [catalog.champions, ranked, filters, board]
  )

  /**
   * The filters drive the rows as well as the pool, so narrowing to a class
   * turns the whole board into that sub-list.
   */
  const visibleByTier = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const tier of board.tiers) {
      map.set(
        tier.id,
        tier.championIds.filter((id) => {
          const champion = catalog.byId.get(id)
          return champion ? matchesFilters(champion, filters, board) : false
        })
      )
    }
    return map
  }, [board, filters, catalog.byId])

  /** Which container an id belongs to — a row id, a champion id, or the pool. */
  const containerOf = useCallback(
    (id: string): string => {
      if (id === POOL_ID) return POOL_ID
      if (board.tiers.some((tier) => tier.id === id)) return id
      return board.tiers.find((tier) => tier.championIds.includes(id))?.id ?? POOL_ID
    },
    [board.tiers]
  )

  const onDragEnd = (event: DragEndEvent) => {
    setDraggingId(null)
    const { active, over } = event
    if (!over) return

    const championId = String(active.id)
    const overId = String(over.id)
    const targetTierId = containerOf(overId)
    if (targetTierId === POOL_ID) {
      actions.moveChampion(championId, POOL_ID)
      return
    }
    // Dropped onto another champion: take its slot. Dropped onto the row itself:
    // append. Detach-then-insert gives the same result as an array move.
    const target = board.tiers.find((tier) => tier.id === targetTierId)
    const overIndex = target?.championIds.indexOf(overId) ?? -1
    actions.moveChampion(championId, targetTierId, overIndex === -1 ? undefined : overIndex)
  }

  const draggingChampion = draggingId ? catalog.byId.get(draggingId) : undefined
  const openChampion = openChampionId ? (catalog.byId.get(openChampionId) ?? null) : null

  if (catalog.error) {
    return <p className='p-6 text-sm text-destructive'>{t.tierlist.loadError}</p>
  }
  // Nothing until the stored board has been read — rendering the default first
  // would flash an empty tier list over the one the visitor saved.
  if (catalog.loading || !persistence.loaded) return null

  return (
    <div className='mx-auto flex max-w-7xl flex-col gap-4 px-3 py-4 sm:px-5'>
      <TierListHeader
        board={board}
        actions={actions}
        prefs={prefs}
        setPrefs={setPrefs}
        filters={filters}
        onFiltersChange={setFilters}
        shown={poolChampions.length}
        total={catalog.champions.length}
        persistence={persistence}
      />

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={(event: DragStartEvent) => setDraggingId(String(event.active.id))}
        onDragEnd={onDragEnd}
        onDragCancel={() => setDraggingId(null)}
      >
        <div className='flex flex-col gap-2'>
          {board.tiers.map((tier, index) => (
            <TierRow
              key={tier.id}
              tier={tier}
              visibleIds={visibleByTier.get(tier.id) ?? []}
              board={board}
              byId={catalog.byId}
              actions={actions}
              cardSize={prefs.cardSize}
              showNames={prefs.showNames}
              showBadges={prefs.showBadges}
              canRemove={board.tiers.length > 1}
              isFirst={index === 0}
              isLast={index === board.tiers.length - 1}
              onOpenChampion={setOpenChampionId}
            />
          ))}
        </div>

        <button
          type='button'
          onClick={actions.addTier}
          data-cy='tierlist-add-row'
          className='inline-flex w-fit items-center gap-1.5 rounded-md border border-dashed px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground'
        >
          <Plus className='size-4' />
          {t.tierlist.addTier}
        </button>

        <ChampionPool
          champions={poolChampions}
          board={board}
          cardSize={prefs.cardSize}
          showNames={prefs.showNames}
          showBadges={prefs.showBadges}
          onOpenChampion={setOpenChampionId}
        />

        <DragOverlay dropAnimation={null}>
          {draggingChampion && (
            <ChampionCardVisual
              champion={draggingChampion}
              tags={tagsOf(board, draggingChampion.id)}
              size={prefs.cardSize}
              showName={prefs.showNames}
              showBadges={prefs.showBadges}
            />
          )}
        </DragOverlay>
      </DndContext>

      <ChampionSheet
        champion={openChampion}
        tags={openChampion ? tagsOf(board, openChampion.id) : tagsOf(board, '')}
        actions={actions}
        onClose={() => setOpenChampionId(null)}
      />
    </div>
  )
}

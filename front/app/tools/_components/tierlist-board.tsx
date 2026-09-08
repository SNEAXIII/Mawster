'use client'

import { useCallback, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { CollisionDetection, DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { Play, Plus } from 'lucide-react'
import { useI18n } from '@/app/i18n'
import { cn } from '@/app/lib/utils'
import { ExportModeProvider } from '@/app/contexts/export-mode-context'
import ChampionPool from './champion-pool'
import ChampionSheet from './champion-sheet'
import ImportLocalBoardDialog from './import-local-board-dialog'
import ReviewMode from './review-mode'
import TierListHeader from './tierlist-header'
import TierListPicker from './tierlist-picker'
import TierListToolbar from './tierlist-toolbar'
import TierRow from './tier-row'
import { ChampionCardVisual } from './champion-card'
import { POOL_ID } from '../_hooks/use-board'
import { tagsOf } from '../_lib/board'
import { useTierListViewModel } from '../_viewmodels/use-tierlist-viewmodel'

/**
 * Which row the pointer is over, asked in the order that actually answers it.
 *
 * `closestCenter` alone compares centres, so a row barely taller than a card
 * loses to whatever sits next to it and the drop lands one row off — the pool
 * being ten times taller than a row makes it worse. The pointer is what the
 * player is aiming with, so it is asked first; the rest only catches the moment
 * it leaves every droppable.
 */
const collisionDetection: CollisionDetection = (args) => {
  const byPointer = pointerWithin(args)
  if (byPointer.length > 0) return byPointer
  const byOverlap = rectIntersection(args)
  return byOverlap.length > 0 ? byOverlap : closestCenter(args)
}

export default function TierListBoard() {
  const { t } = useI18n()
  const vm = useTierListViewModel()
  const [openChampionId, setOpenChampionId] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)

  const sensors = useSensors(
    // The mouse needs a small threshold so a plain click still opens the sheet;
    // touch uses a long press instead, which leaves scrolling over the pool intact.
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  /** Which container an id belongs to — a row id, a champion id, or the pool. */
  const containerOf = useCallback(
    (id: string): string => {
      if (id === POOL_ID) return POOL_ID
      if (vm.board.tiers.some((tier) => tier.id === id)) return id
      return vm.board.tiers.find((tier) => tier.championIds.includes(id))?.id ?? POOL_ID
    },
    [vm.board.tiers]
  )

  const onDragEnd = (event: DragEndEvent) => {
    setDraggingId(null)
    const { active, over } = event
    if (!over) return

    const championId = String(active.id)
    const overId = String(over.id)
    const targetTierId = containerOf(overId)
    if (targetTierId === POOL_ID) {
      vm.actions.moveChampion(championId, POOL_ID)
      return
    }
    // Dropped onto another champion: take its slot. Dropped onto the row itself:
    // append. Detach-then-insert gives the same result as an array move.
    const target = vm.board.tiers.find((tier) => tier.id === targetTierId)
    const overIndex = target?.championIds.indexOf(overId) ?? -1
    vm.actions.moveChampion(championId, targetTierId, overIndex === -1 ? undefined : overIndex)
  }

  const draggingChampion = draggingId ? vm.catalog.byId.get(draggingId) : undefined
  const openChampion = openChampionId ? (vm.catalog.byId.get(openChampionId) ?? null) : null

  if (vm.catalog.error) {
    return <p className='text-sm text-destructive'>{t.tierlist.loadError}</p>
  }
  // Nothing until the stored board has been read — rendering the default first
  // would flash an empty tier list over the one the visitor saved.
  if (vm.catalog.loading || !vm.persistence.loaded) return null

  return (
    <ExportModeProvider value={vm.exporting}>
      <div className='flex flex-col gap-4'>
        <div className='flex flex-wrap items-center justify-between gap-2'>
          {vm.signedIn && (
            <TierListPicker
              lists={vm.tierLists.lists}
              activeId={vm.activeId}
              activeRankedCount={vm.rankedCount}
              activeTitle={vm.board.title}
              onSelect={vm.setActiveId}
              onCreate={vm.handleCreateList}
              onDelete={vm.handleDeleteList}
            />
          )}
          <TierListToolbar
            busy={vm.exporting}
            onExportJson={vm.handleExportJson}
            onImportJson={vm.handleImportJson}
            onExportPng={vm.handleExportPng}
            onReset={vm.handleReset}
          />
        </div>

        {/* A refused create — the twenty-list cap, most often — would otherwise
            do nothing visible at all: the button clicks and no list appears. */}
        {vm.tierLists.error && (
          <p
            className='text-xs text-destructive'
            data-cy='tierlist-list-error'
          >
            {vm.tierLists.error}
          </p>
        )}

        {!vm.signedIn && <p className='text-xs text-muted-foreground'>{t.tierlist.signedOut}</p>}

        <TierListHeader
          board={vm.board}
          actions={vm.actions}
          prefs={vm.prefs}
          setPrefs={vm.setPrefs}
          filters={vm.filters}
          onFiltersChange={vm.setFilters}
          shown={vm.poolChampions.length}
          total={vm.catalog.champions.length}
          persistence={vm.persistence}
        />

        <div className='flex flex-wrap items-center gap-3'>
          <button
            type='button'
            onClick={vm.startReview}
            disabled={vm.reviewChampions.length === 0}
            data-cy='tierlist-start-review'
            className='inline-flex w-fit items-center gap-1.5 rounded-md border border-primary/50 px-3 py-1.5 text-xs font-bold text-primary transition-colors hover:bg-primary hover:text-primary-foreground disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-primary'
          >
            <Play className='size-4' />
            {t.tierlist.review} ({vm.reviewChampions.length})
          </button>
          <label className='flex items-center gap-1.5 text-xs font-semibold text-muted-foreground'>
            <input
              type='checkbox'
              checked={vm.reviewPlaced}
              onChange={(event) => vm.setReviewPlaced(event.target.checked)}
              data-cy='tierlist-review-include-placed'
            />
            {t.tierlist.reviewIncludePlaced}
          </label>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetection}
          onDragStart={(event: DragStartEvent) => setDraggingId(String(event.active.id))}
          onDragEnd={onDragEnd}
          onDragCancel={() => setDraggingId(null)}
        >
          {/* Capture root for the PNG: the title and the rows, nothing else. */}
          <div
            ref={vm.boardRef}
            className={cn(
              'flex flex-col gap-2 rounded-lg p-2',
              vm.exporting ? 'bg-black' : 'bg-background'
            )}
          >
            {vm.board.title && <h2 className='px-1 text-xl font-black'>{vm.board.title}</h2>}
            {vm.board.tiers.map((tier, index) => (
              <TierRow
                key={tier.id}
                tier={tier}
                visibleIds={vm.visibleByTier.get(tier.id) ?? []}
                board={vm.board}
                byId={vm.catalog.byId}
                actions={vm.actions}
                cardSize={vm.prefs.cardSize}
                showNames={vm.prefs.showNames}
                showBadges={vm.prefs.showBadges}
                canRemove={vm.board.tiers.length > 1}
                exporting={vm.exporting}
                isFirst={index === 0}
                isLast={index === vm.board.tiers.length - 1}
                onOpenChampion={setOpenChampionId}
              />
            ))}
          </div>

          <button
            type='button'
            onClick={vm.actions.addTier}
            data-cy='tierlist-add-row'
            className='inline-flex w-fit items-center gap-1.5 rounded-md border border-dashed px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground'
          >
            <Plus className='size-4' />
            {t.tierlist.addTier}
          </button>

          <ChampionPool
            champions={vm.poolChampions}
            board={vm.board}
            cardSize={vm.prefs.cardSize}
            showNames={vm.prefs.showNames}
            showBadges={vm.prefs.showBadges}
            onOpenChampion={setOpenChampionId}
          />

          <DragOverlay dropAnimation={null}>
            {draggingChampion && (
              <ChampionCardVisual
                champion={draggingChampion}
                tags={tagsOf(vm.board, draggingChampion.id)}
                size={vm.prefs.cardSize}
                showName={vm.prefs.showNames}
                showBadges={vm.prefs.showBadges}
              />
            )}
          </DragOverlay>
        </DndContext>

        <ChampionSheet
          champion={openChampion}
          board={vm.board}
          tags={openChampion ? tagsOf(vm.board, openChampion.id) : tagsOf(vm.board, '')}
          actions={vm.actions}
          onClose={() => setOpenChampionId(null)}
        />
        {vm.reviewQueue && (
          <ReviewMode
            championIds={vm.reviewQueue}
            byId={vm.catalog.byId}
            board={vm.board}
            actions={vm.actions}
            onClose={vm.closeReview}
          />
        )}
        <ImportLocalBoardDialog
          storedBoard={vm.offerLocalBoard}
          onImport={vm.handleImportLocalBoard}
          onDiscard={vm.handleDiscardLocalBoard}
        />
      </div>
    </ExportModeProvider>
  )
}

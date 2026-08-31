import { useCallback, useMemo, useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { PlusIcon } from '@heroicons/react/24/solid'
import Toolbar from '@/components/toolbar'
import FilterBar from '@/components/filter-bar'
import TierRow from '@/components/tier-row'
import ChampionPool from '@/components/champion-pool'
import ChampionSheet from '@/components/champion-sheet'
import IconMockup from '@/components/icon-mockup'
import { ChampionCardVisual } from '@/components/champion-card'
import { BANNED_COUNT, CHAMPIONS, CHAMPIONS_BY_ID } from '@/data/champions'
import { attributesOf, rankedIds } from '@/lib/board'
import { EMPTY_FILTERS, matchesFilters, type FilterState } from '@/lib/filters'
import { exportJson, exportPng, importJson } from '@/lib/export'
import { POOL_ID, useBoard } from '@/lib/use-board'
import { usePrefs } from '@/lib/use-prefs'
import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'

/** Let the browser paint the export-only styles before snapdom reads the DOM. */
function nextFrames(): Promise<void> {
  return new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  )
}

export default function App() {
  const { t, locale, setLocale } = useI18n()
  const { board, hydrated, actions } = useBoard()
  const [prefs, setPrefs] = usePrefs()
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS)
  const [openChampionId, setOpenChampionId] = useState<string | null>(null)
  const [iconsOpen, setIconsOpen] = useState(false)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const boardRef = useRef<HTMLDivElement>(null)

  const sensors = useSensors(
    // Mouse needs a small threshold so a click still opens the sheet; touch uses
    // a long-press instead, which leaves normal scrolling over the pool intact.
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const ranked = useMemo(() => rankedIds(board), [board])
  const poolChampions = useMemo(
    () => CHAMPIONS.filter((c) => !ranked.has(c.id) && matchesFilters(c, filters, board)),
    [ranked, filters, board]
  )

  /** Which container an id belongs to — a tier id, a champion id, or the pool. */
  const containerOf = useCallback(
    (id: string): string => {
      if (id === POOL_ID) return POOL_ID
      if (board.tiers.some((tier) => tier.id === id)) return id
      return board.tiers.find((tier) => tier.championIds.includes(id))?.id ?? POOL_ID
    },
    [board.tiers]
  )

  const onDragStart = (event: DragStartEvent) => setDraggingId(String(event.active.id))

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
    // Dropped onto another champion: take its slot. Dropped onto the row
    // itself: append. Detach-then-insert gives the same result as arrayMove.
    const target = board.tiers.find((tier) => tier.id === targetTierId)
    const overIndex = target?.championIds.indexOf(overId) ?? -1
    actions.moveChampion(championId, targetTierId, overIndex === -1 ? undefined : overIndex)
  }

  const handleExportPng = async () => {
    if (!boardRef.current) return
    setExporting(true)
    try {
      await nextFrames()
      await exportPng(boardRef.current, board)
    } catch {
      // Almost always a tainted canvas: the static host answered without
      // `Access-Control-Allow-Origin`, so the portraits cannot be read back.
      setNotice(t.exportPngError)
    } finally {
      setExporting(false)
    }
  }

  const handleImport = async (file: File) => {
    const imported = await importJson(file)
    if (!imported) {
      setNotice(t.importError)
      return
    }
    actions.replaceBoard(imported)
    setNotice(t.importDone)
  }

  const handleReset = () => {
    if (window.confirm(t.resetConfirm)) actions.resetBoard()
  }

  const draggingChampion = draggingId ? CHAMPIONS_BY_ID.get(draggingId) : undefined
  const openChampion = openChampionId ? (CHAMPIONS_BY_ID.get(openChampionId) ?? null) : null

  // Nothing to show until localStorage has been read — rendering the default
  // board first would flash an empty tier list over the user's saved one.
  if (!hydrated) return null

  return (
    <div className={cn('min-h-dvh px-3 py-4 sm:px-5', exporting && 'exporting')}>
      <div className='mx-auto flex max-w-7xl flex-col gap-4'>
        <header className='flex items-baseline justify-between gap-3'>
          <h1 className='text-lg font-black tracking-tight sm:text-xl'>{t.appTitle}</h1>
          <p className='hidden text-xs text-muted-foreground sm:block'>{t.dragHint}</p>
        </header>

        <Toolbar
          title={board.title}
          onTitleChange={actions.setTitle}
          frame={board.frame}
          onFrameChange={actions.setFrame}
          cardSize={prefs.cardSize}
          onCardSizeChange={(cardSize) => setPrefs({ cardSize })}
          showNames={prefs.showNames}
          onShowNamesChange={(showNames) => setPrefs({ showNames })}
          showBadges={prefs.showBadges}
          onShowBadgesChange={(showBadges) => setPrefs({ showBadges })}
          locale={locale}
          onLocaleChange={setLocale}
          busy={exporting}
          onExportJson={() => exportJson(board)}
          onImportJson={handleImport}
          onExportPng={handleExportPng}
          onReset={handleReset}
          onOpenIcons={() => setIconsOpen(true)}
          t={t}
        />

        {notice && (
          <button
            type='button'
            onClick={() => setNotice(null)}
            className='rounded-md border border-border bg-elevated px-3 py-2 text-left text-xs text-muted-foreground'
          >
            {notice}
          </button>
        )}

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={() => setDraggingId(null)}
        >
          {/* Capture root for the PNG export: the title and the tiers, nothing else. */}
          <div
            ref={boardRef}
            className='flex flex-col gap-2 rounded-lg bg-background p-2'
          >
            {board.title && <h2 className='px-1 text-xl font-black'>{board.title}</h2>}
            {board.tiers.map((tier, index) => (
              <TierRow
                key={tier.id}
                tier={tier}
                board={board}
                actions={actions}
                t={t}
                cardSize={prefs.cardSize}
                showNames={prefs.showNames}
                showBadges={prefs.showBadges}
                exporting={exporting}
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
            className='inline-flex w-fit items-center gap-1.5 rounded-md border border-dashed border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground'
          >
            <PlusIcon className='h-4 w-4' />
            {t.addTier}
          </button>

          <section className='flex flex-col gap-3'>
            <FilterBar
              filters={filters}
              onChange={setFilters}
              iconChoices={board.iconChoices}
              shown={poolChampions.length}
              total={CHAMPIONS.length}
              t={t}
            />
            <ChampionPool
              champions={poolChampions}
              board={board}
              cardSize={prefs.cardSize}
              showNames={prefs.showNames}
              showBadges={prefs.showBadges}
              t={t}
              onOpenChampion={setOpenChampionId}
            />
          </section>

          <DragOverlay dropAnimation={null}>
            {draggingChampion && (
              <ChampionCardVisual
                champion={draggingChampion}
                attributes={attributesOf(board, draggingChampion.id)}
                iconChoices={board.iconChoices}
                size={prefs.cardSize}
                frame={board.frame}
                showName={prefs.showNames}
                showBadges={prefs.showBadges}
              />
            )}
          </DragOverlay>
        </DndContext>

        <footer className='pb-6 text-[11px] leading-relaxed text-muted-foreground'>
          <p>{t.aboutData}</p>
          <p>{t.aboutBanned(BANNED_COUNT)}</p>
        </footer>
      </div>

      <ChampionSheet
        champion={openChampion}
        board={board}
        actions={actions}
        t={t}
        onClose={() => setOpenChampionId(null)}
      />
      <IconMockup
        open={iconsOpen}
        onClose={() => setIconsOpen(false)}
        iconChoices={board.iconChoices}
        actions={actions}
        t={t}
      />
    </div>
  )
}

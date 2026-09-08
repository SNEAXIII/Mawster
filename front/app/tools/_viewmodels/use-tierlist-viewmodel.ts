'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useI18n } from '@/app/i18n'
import { useImageExport } from '@/hooks/use-image-export'
import { toast } from 'sonner'
import { useBoard } from '../_hooks/use-board'
import { useBoardPersistence } from '../_hooks/use-board-persistence'
import { useCatalog } from '../_hooks/use-catalog'
import { usePrefs } from '../_hooks/use-prefs'
import { useTierLists } from '../_hooks/use-tierlists'
import { defaultBoard, rankedIds } from '../_lib/board'
import { boardFilename, exportJson, importJson } from '../_lib/export'
import { EMPTY_FILTERS, matchesFilters } from '../_lib/filters'
import type { FilterState } from '../_lib/filters'

/** Everything the tier list page holds, so the components stay presentational. */
export function useTierListViewModel() {
  const { t } = useI18n()
  const { status } = useSession()
  const catalog = useCatalog()
  const { board, setBoard, actions } = useBoard()
  const tierLists = useTierLists()
  const [activeId, setActiveId] = useState<string | null>(null)
  // A first change on an account with no list creates one through the save, not
  // through the create button — so the selector has to hear about it from there.
  const refreshLists = tierLists.refresh
  const handleListCreatedBySave = useCallback(
    (id: string) => {
      setActiveId(id)
      void refreshLists()
    },
    [refreshLists]
  )
  const persistence = useBoardPersistence(
    board,
    setBoard,
    catalog.knownIds,
    !catalog.loading,
    activeId,
    handleListCreatedBySave
  )
  const [prefs, setPrefs] = usePrefs()
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS)
  const { exporting, exportPng } = useImageExport()
  const [localBoardHandled, setLocalBoardHandled] = useState(false)
  // Snapshot of the queue, taken when a run starts; null while idle.
  const [reviewQueue, setReviewQueue] = useState<string[] | null>(null)
  // Whether a run also walks champions already sitting in a row.
  const [reviewPlaced, setReviewPlaced] = useState(false)
  const boardRef = useRef<HTMLDivElement>(null)

  // Open the account's first list once they are known, and follow along when
  // one is created or the open one is deleted.
  useEffect(() => {
    if (tierLists.loading) return
    if (tierLists.lists.length === 0) {
      setActiveId(null)
      return
    }
    if (!activeId || !tierLists.lists.some((list) => list.id === activeId)) {
      setActiveId(tierLists.lists[0].id)
    }
  }, [tierLists.loading, tierLists.lists, activeId])

  const ranked = useMemo(() => rankedIds(board), [board])
  const poolChampions = useMemo(
    () =>
      catalog.champions.filter(
        (champion) => !ranked.has(champion.id) && matchesFilters(champion, filters, board)
      ),
    [catalog.champions, ranked, filters, board]
  )

  /**
   * What a run walks: the filtered pool, plus — when asked — the champions
   * already in a row, so a past call never makes one un-reviewable.
   */
  const reviewChampions = useMemo(
    () =>
      reviewPlaced
        ? catalog.champions.filter((champion) => matchesFilters(champion, filters, board))
        : poolChampions,
    [reviewPlaced, catalog.champions, poolChampions, filters, board]
  )

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

  const handleExportPng = useCallback(async () => {
    try {
      await exportPng(boardRef, boardFilename(board.title, 'png'))
    } catch (error) {
      toast.error(t.tierlist.exportPngError.replace('{error}', (error as Error).message))
    }
  }, [board.title, exportPng, t])

  const handleImportJson = useCallback(
    async (file: File) => {
      const imported = await importJson(file, catalog.knownIds)
      if (!imported) {
        toast.error(t.tierlist.importError)
        return
      }
      // Keep the id: the file lands in the list that is open rather than
      // creating one, which is what "import into this board" means.
      actions.replaceBoard({ ...imported, id: board.id })
      toast.success(t.tierlist.importDone)
    },
    [actions, board.id, catalog.knownIds, t]
  )

  const handleCreateList = useCallback(async () => {
    const created = await tierLists.create()
    if (created) setActiveId(created.id)
  }, [tierLists])

  const handleDeleteList = useCallback(async () => {
    if (!activeId) return
    await tierLists.remove(activeId)
    setActiveId(null)
  }, [activeId, tierLists])

  const handleImportLocalBoard = useCallback(() => {
    if (persistence.storedBoard) {
      actions.replaceBoard({ ...persistence.storedBoard, id: board.id })
    }
    persistence.dropStoredBoard()
    setLocalBoardHandled(true)
  }, [actions, board.id, persistence])

  const handleDiscardLocalBoard = useCallback(() => {
    persistence.dropStoredBoard()
    setLocalBoardHandled(true)
  }, [persistence])

  /** The browser's board is only worth offering to someone signed in. */
  const offerLocalBoard =
    status === 'authenticated' && !localBoardHandled && persistence.loaded
      ? persistence.storedBoard
      : null

  return {
    catalog,
    board,
    actions,
    prefs,
    setPrefs,
    filters,
    setFilters,
    persistence,
    tierLists,
    activeId,
    setActiveId,
    poolChampions,
    rankedCount: ranked.size,
    reviewChampions,
    reviewQueue,
    reviewPlaced,
    setReviewPlaced,
    startReview: () => setReviewQueue(reviewChampions.map((champion) => champion.id)),
    closeReview: () => setReviewQueue(null),
    visibleByTier,
    boardRef,
    exporting,
    offerLocalBoard,
    signedIn: status === 'authenticated',
    handleExportJson: () => exportJson(board),
    handleExportPng,
    handleImportJson,
    handleCreateList,
    handleDeleteList,
    handleReset: () => actions.replaceBoard({ ...defaultBoard(), id: board.id }),
    handleImportLocalBoard,
    handleDiscardLocalBoard,
  }
}

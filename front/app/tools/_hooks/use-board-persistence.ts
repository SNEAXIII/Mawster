'use client'

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { createTierList, loadTierList, saveTierList } from '../_lib/lists'
import type { BoardState } from '../_lib/types'

interface BoardPersistenceOptions {
  board: BoardState
  setBoard: Dispatch<SetStateAction<BoardState>>
  knownIds: Set<string>
  catalogReady: boolean
  /**
   * False while the lists are still being read. The saver must not be armed
   * before then: the board is still the empty default and `activeListId` still
   * null, so a write fired in that window would create a second, empty list.
   */
  listsReady: boolean
  activeListId: string | null
  /** Called with the id when this board's first change had to create the list. */
  onListCreated?: (id: string) => void
}

/**
 * Reads the selected list into the board, and writes the board back to this
 * browser on every change. Nothing is written when nothing changed: the last
 * board written is kept and compared, so filtering and scrolling cost nothing.
 *
 * @returns whether the board has been read — render nothing before.
 */
export function useBoardPersistence({
  board,
  setBoard,
  knownIds,
  catalogReady,
  listsReady,
  activeListId,
  onListCreated,
}: BoardPersistenceOptions): boolean {
  const [loaded, setLoaded] = useState(false)
  const lastWritten = useRef<string | null>(null)
  // Through refs: neither belongs in the effect deps below — the callback is an
  // inline arrow at the call site, and the board changes on every gesture.
  const onListCreatedRef = useRef(onListCreated)
  onListCreatedRef.current = onListCreated
  const boardRef = useRef(board)
  boardRef.current = board

  useEffect(() => {
    if (!catalogReady || !listsReady) return
    const next = activeListId ? loadTierList(activeListId, knownIds) : null
    // A list created from here a moment ago is this very board: reading it
    // back would throw away whatever has moved since.
    if (next && activeListId !== boardRef.current.id) {
      lastWritten.current = JSON.stringify(next)
      setBoard(next)
    } else {
      // An empty shelf shows the default board, saved only once it changes.
      lastWritten.current ??= JSON.stringify(boardRef.current)
    }
    setLoaded(true)
    // knownIds and setBoard are stable for a given catalog; re-running on them
    // would reload the list on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogReady, listsReady, activeListId])

  useEffect(() => {
    if (!loaded) return
    const serialized = JSON.stringify(board)
    if (serialized === lastWritten.current) return
    lastWritten.current = serialized
    if (board.id) {
      saveTierList({ ...board, id: board.id })
      return
    }
    const id = createTierList(board)
    if (!id) return
    setBoard((current) => ({ ...current, id }))
    // The list did not exist when the page loaded, so the picker has to be told.
    onListCreatedRef.current?.(id)
  }, [board, loaded, setBoard])

  return loaded
}

'use client'

import { useEffect, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useSession } from 'next-auth/react'
import { createTierList, fetchTierList, saveTierList } from '@/app/services/tierlist'
import { fromDetail, forgetStoredBoard, loadStoredBoard, storeBoard } from '../_lib/board'
import { toSavePayload } from '../_lib/types'
import type { BoardState } from '../_lib/types'

/** How long the board sits still before it is written back. */
const SAVE_DELAY_MS = 1000

interface Persistence {
  /** False until the stored or saved board has been read — render nothing before. */
  loaded: boolean
  saving: boolean
  error: string | null
  /** The board kept in this browser, when the visitor has one. */
  storedBoard: BoardState | null
  /** Forget the browser's board, for good — once it lives in an account. */
  dropStoredBoard: () => void
}

/**
 * Reads the board on mount and writes it back a second after the last change.
 *
 * Signed in, the board is whichever tier list is selected, and it travels whole
 * on every save — the API replaces it rather than being told what moved. Signed
 * out, it lives in this browser, alone. Nothing is sent when nothing changed:
 * the last payload written is kept and compared, so idling costs no requests.
 */
interface BoardPersistenceOptions {
  board: BoardState
  setBoard: Dispatch<SetStateAction<BoardState>>
  knownIds: Set<string>
  catalogReady: boolean
  /**
   * False while the account's tier lists are still being listed.
   *
   * The saver must not be armed before then: signed in with the lists unknown,
   * the board is still the empty default and `activeListId` still null, so a
   * save fired in that window would create a second, empty list instead of
   * writing to the one the account already has.
   */
  listsReady: boolean
  activeListId: string | null
  /** Called with the id when this board's first save had to create the list. */
  onListCreated?: (id: string) => void
}

export function useBoardPersistence({
  board,
  setBoard,
  knownIds,
  catalogReady,
  listsReady,
  activeListId,
  onListCreated,
}: BoardPersistenceOptions): Persistence {
  const { status } = useSession()
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [storedBoard, setStoredBoard] = useState<BoardState | null>(null)
  const lastWritten = useRef<string | null>(null)
  // Through refs: neither belongs in the effect deps below — the callback is an
  // inline arrow at the call site, and the board id changes on every save.
  const onListCreatedRef = useRef(onListCreated)
  onListCreatedRef.current = onListCreated
  const boardIdRef = useRef(board.id)
  boardIdRef.current = board.id

  const signedIn = status === 'authenticated'

  // Read the browser's board either way: signed in, it is what the import
  // dialog offers to bring over rather than overwriting anything.
  useEffect(() => {
    if (!catalogReady) return
    setStoredBoard(loadStoredBoard(knownIds))
  }, [catalogReady, knownIds])

  useEffect(() => {
    if (!catalogReady || status === 'loading') return
    // Signed in, wait until the lists are known: which board to read is not
    // answerable before that, and `loaded` is what arms the saver.
    if (signedIn && !listsReady) return
    let cancelled = false

    const run = async () => {
      try {
        if (signedIn && activeListId && activeListId === boardIdRef.current) {
          // This board *is* that list: it was created from here a moment ago,
          // so the server holds exactly what was sent. Fetching it again would
          // throw away whatever has been moved since.
          return
        }
        if (signedIn && activeListId) {
          const next = fromDetail(await fetchTierList(activeListId))
          if (cancelled) return
          lastWritten.current = JSON.stringify(toSavePayload(next))
          setBoard(next)
        } else if (!signedIn) {
          const stored = loadStoredBoard(knownIds)
          if (!cancelled && stored) setBoard(stored)
        }
      } catch (err) {
        if (!cancelled) setError((err as Error).message)
      } finally {
        if (!cancelled) setLoaded(true)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
    // knownIds and setBoard are stable for a given catalog; re-running on them
    // would refetch the list on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogReady, status, signedIn, listsReady, activeListId])

  useEffect(() => {
    if (!loaded) return
    const payload = toSavePayload(board)
    const serialized = JSON.stringify(payload)
    // Nothing moved since the last write — scrolling and filtering must not save.
    if (serialized === lastWritten.current) return

    const timer = setTimeout(async () => {
      setSaving(true)
      setError(null)
      try {
        if (!signedIn) {
          storeBoard(board)
        } else if (board.id) {
          await saveTierList(board.id, payload)
        } else {
          const created = await createTierList(payload)
          // Through an updater, never `{ ...board }`: that board was captured a
          // second ago, and anything dropped while the request was in flight
          // would be thrown away — the card visibly springs back.
          setBoard((current) => ({ ...current, id: created.id }))
          // The list did not exist when the page loaded, so the selector knows
          // nothing about it: it has to be told, or it stays hidden until a reload.
          onListCreatedRef.current?.(created.id)
        }
        lastWritten.current = serialized
      } catch (err) {
        setError((err as Error).message)
      } finally {
        setSaving(false)
      }
    }, SAVE_DELAY_MS)

    return () => clearTimeout(timer)
  }, [board, loaded, signedIn, setBoard])

  return {
    loaded,
    saving,
    error,
    storedBoard,
    dropStoredBoard: () => {
      forgetStoredBoard()
      setStoredBoard(null)
    },
  }
}

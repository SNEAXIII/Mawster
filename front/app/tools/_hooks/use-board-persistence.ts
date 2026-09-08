'use client'

import { useEffect, useRef, useState } from 'react'
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
export function useBoardPersistence(
  board: BoardState,
  setBoard: (board: BoardState) => void,
  knownIds: Set<string>,
  catalogReady: boolean,
  activeListId: string | null
): Persistence {
  const { status } = useSession()
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [storedBoard, setStoredBoard] = useState<BoardState | null>(null)
  const lastWritten = useRef<string | null>(null)

  const signedIn = status === 'authenticated'

  // Read the browser's board either way: signed in, it is what the import
  // dialog offers to bring over rather than overwriting anything.
  useEffect(() => {
    if (!catalogReady) return
    setStoredBoard(loadStoredBoard(knownIds))
  }, [catalogReady, knownIds])

  useEffect(() => {
    if (!catalogReady || status === 'loading') return
    let cancelled = false

    const run = async () => {
      try {
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
  }, [catalogReady, status, signedIn, activeListId])

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
          setBoard({ ...board, id: created.id })
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

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import {
  createTierList,
  fetchTierList,
  fetchTierLists,
  saveTierList,
} from '@/app/services/tierlist'
import { fromDetail, loadStoredBoard, storeBoard } from '../_lib/board'
import { toSavePayload } from '../_lib/types'
import type { BoardState } from '../_lib/types'

/** How long the board sits still before it is written back. */
const SAVE_DELAY_MS = 1000

interface Persistence {
  /** False until the stored or saved board has been read — render nothing before. */
  loaded: boolean
  saving: boolean
  error: string | null
  /** The board kept in this browser, when the visitor is signed out and has one. */
  storedBoard: BoardState | null
}

/**
 * Reads the board on mount and writes it back a second after the last change.
 *
 * Signed in, the board lives in the account and travels whole on every save —
 * the API replaces it rather than being told what moved. Signed out, it lives in
 * this browser, alone. Nothing is sent when nothing changed: the last payload
 * written is kept and compared, so idling on the page costs no requests.
 */
export function useBoardPersistence(
  board: BoardState,
  setBoard: (board: BoardState) => void,
  knownIds: Set<string>,
  catalogReady: boolean
): Persistence {
  const { status } = useSession()
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [storedBoard, setStoredBoard] = useState<BoardState | null>(null)
  const lastWritten = useRef<string | null>(null)

  const signedIn = status === 'authenticated'

  const loadSignedIn = useCallback(async () => {
    const lists = await fetchTierLists()
    // The account's first list is the one the board opens on. Picking between
    // several is the list picker's job, and it comes with the next lot.
    if (lists.length === 0) return
    const detail = await fetchTierList(lists[0].id)
    const next = fromDetail(detail)
    lastWritten.current = JSON.stringify(toSavePayload(next))
    setBoard(next)
  }, [setBoard])

  useEffect(() => {
    if (!catalogReady || status === 'loading' || loaded) return
    let cancelled = false

    const run = async () => {
      try {
        // Read the browser's board either way: signed in, it is what the import
        // dialog offers to bring over rather than overwriting anything.
        const stored = loadStoredBoard(knownIds)
        if (!cancelled) setStoredBoard(stored)
        if (signedIn) await loadSignedIn()
        else if (stored) setBoard(stored)
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
  }, [catalogReady, status, loaded, signedIn, knownIds, loadSignedIn, setBoard])

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

  return { loaded, saving, error, storedBoard }
}

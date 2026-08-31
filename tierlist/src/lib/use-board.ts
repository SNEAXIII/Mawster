import { useCallback, useEffect, useMemo, useState } from 'react'
import { TIER_PALETTE, attributesOf, defaultBoard, loadBoard, newTierId, saveBoard } from './board'
import type { AttributeKey, BoardState, FrameOption, Tier } from './types'

/** Pool acts as a droppable container like any tier; this is its container id. */
export const POOL_ID = 'pool'

function withTiers(board: BoardState, tiers: Tier[]): BoardState {
  return { ...board, tiers }
}

/** Remove a champion from every tier — used before re-inserting it elsewhere. */
function detach(tiers: Tier[], championId: string): Tier[] {
  return tiers.map((t) =>
    t.championIds.includes(championId)
      ? { ...t, championIds: t.championIds.filter((id) => id !== championId) }
      : t
  )
}

/**
 * The board and every mutation the UI can apply to it, persisted to
 * localStorage on each change. Kept in one hook so the reducer-ish logic
 * (move / reorder / retag) lives next to the state it owns rather than being
 * spread across the components that trigger it.
 */
export function useBoard() {
  const [board, setBoard] = useState<BoardState>(defaultBoard)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setBoard(loadBoard())
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (hydrated) saveBoard(board)
  }, [board, hydrated])

  const moveChampion = useCallback((championId: string, targetTierId: string, index?: number) => {
    setBoard((b) => {
      const tiers = detach(b.tiers, championId)
      if (targetTierId === POOL_ID) return withTiers(b, tiers)
      return withTiers(
        b,
        tiers.map((t) => {
          if (t.id !== targetTierId) return t
          const ids = [...t.championIds]
          ids.splice(index ?? ids.length, 0, championId)
          return { ...t, championIds: ids }
        })
      )
    })
  }, [])

  const clearTier = useCallback((tierId: string) => {
    setBoard((b) =>
      withTiers(
        b,
        b.tiers.map((t) => (t.id === tierId ? { ...t, championIds: [] } : t))
      )
    )
  }, [])

  const addTier = useCallback(() => {
    setBoard((b) =>
      withTiers(b, [
        ...b.tiers,
        {
          id: newTierId(),
          label: String.fromCharCode(65 + b.tiers.length) || 'New',
          color: TIER_PALETTE[b.tiers.length % TIER_PALETTE.length],
          championIds: [],
        },
      ])
    )
  }, [])

  /** Dropping a tier sends its champions back to the pool rather than deleting them. */
  const removeTier = useCallback((tierId: string) => {
    setBoard((b) =>
      b.tiers.length <= 1
        ? b
        : withTiers(
            b,
            b.tiers.filter((t) => t.id !== tierId)
          )
    )
  }, [])

  const updateTier = useCallback((tierId: string, patch: Partial<Omit<Tier, 'id'>>) => {
    setBoard((b) =>
      withTiers(
        b,
        b.tiers.map((t) => (t.id === tierId ? { ...t, ...patch } : t))
      )
    )
  }, [])

  const moveTier = useCallback((tierId: string, delta: number) => {
    setBoard((b) => {
      const from = b.tiers.findIndex((t) => t.id === tierId)
      const to = from + delta
      if (from === -1 || to < 0 || to >= b.tiers.length) return b
      const tiers = [...b.tiers]
      const [moved] = tiers.splice(from, 1)
      tiers.splice(to, 0, moved)
      return withTiers(b, tiers)
    })
  }, [])

  const toggleAttribute = useCallback((championId: string, key: AttributeKey) => {
    setBoard((b) => {
      const current = attributesOf(b, championId)
      const next = { ...current.flags, [key]: !current.flags[key] }
      if (!next[key]) delete next[key]
      return { ...b, attributes: { ...b.attributes, [championId]: { ...current, flags: next } } }
    })
  }, [])

  const setSignature = useCallback((championId: string, sig: number | undefined) => {
    setBoard((b) => {
      const current = attributesOf(b, championId)
      const next = { ...current }
      if (sig === undefined) delete next.sig
      else next.sig = sig
      return { ...b, attributes: { ...b.attributes, [championId]: next } }
    })
  }, [])

  const clearAttributes = useCallback((championId: string) => {
    setBoard((b) => {
      const attributes = { ...b.attributes }
      delete attributes[championId]
      return { ...b, attributes }
    })
  }, [])

  const setIconChoice = useCallback((key: AttributeKey, variantId: string) => {
    setBoard((b) => ({ ...b, iconChoices: { ...b.iconChoices, [key]: variantId } }))
  }, [])

  const setFrame = useCallback((frame: FrameOption) => setBoard((b) => ({ ...b, frame })), [])
  const setTitle = useCallback((title: string) => setBoard((b) => ({ ...b, title })), [])
  const replaceBoard = useCallback((next: BoardState) => setBoard(next), [])
  const resetBoard = useCallback(() => setBoard(defaultBoard()), [])

  const actions = useMemo(
    () => ({
      moveChampion,
      clearTier,
      addTier,
      removeTier,
      updateTier,
      moveTier,
      toggleAttribute,
      setSignature,
      clearAttributes,
      setIconChoice,
      setFrame,
      setTitle,
      replaceBoard,
      resetBoard,
    }),
    [
      moveChampion,
      clearTier,
      addTier,
      removeTier,
      updateTier,
      moveTier,
      toggleAttribute,
      setSignature,
      clearAttributes,
      setIconChoice,
      setFrame,
      setTitle,
      replaceBoard,
      resetBoard,
    ]
  )

  return { board, hydrated, actions }
}

export type BoardActions = ReturnType<typeof useBoard>['actions']

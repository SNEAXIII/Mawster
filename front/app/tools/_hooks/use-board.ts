'use client'

import { useCallback, useMemo, useState } from 'react'
import { TIER_PALETTE, defaultBoard, newTierId, tagsOf } from '../_lib/board'
import { NO_TAGS, hasAnyTag } from '../_lib/types'
import type { BoardState, BoardTier, TagKey } from '../_lib/types'

/** The pool is a droppable container like any row; this is its container id. */
export const POOL_ID = 'pool'

function withTiers(board: BoardState, tiers: BoardTier[]): BoardState {
  return { ...board, tiers }
}

/** Remove a champion from every row — used before re-inserting it elsewhere. */
function detach(tiers: BoardTier[], championId: string): BoardTier[] {
  return tiers.map((tier) =>
    tier.championIds.includes(championId)
      ? { ...tier, championIds: tier.championIds.filter((id) => id !== championId) }
      : tier
  )
}

/**
 * The board and every change the page can apply to it. Kept in one hook so the
 * move / reorder / retag logic lives next to the state it owns rather than being
 * spread across the components that trigger it. Saving is somebody else's job —
 * see `useBoardPersistence`.
 */
export function useBoard(initial?: BoardState) {
  const [board, setBoard] = useState<BoardState>(initial ?? defaultBoard)

  const moveChampion = useCallback((championId: string, targetTierId: string, index?: number) => {
    setBoard((current) => {
      const tiers = detach(current.tiers, championId)
      if (targetTierId === POOL_ID) return withTiers(current, tiers)
      return withTiers(
        current,
        tiers.map((tier) => {
          if (tier.id !== targetTierId) return tier
          const ids = [...tier.championIds]
          ids.splice(index ?? ids.length, 0, championId)
          return { ...tier, championIds: ids }
        })
      )
    })
  }, [])

  const clearTier = useCallback((tierId: string) => {
    setBoard((current) =>
      withTiers(
        current,
        current.tiers.map((tier) => (tier.id === tierId ? { ...tier, championIds: [] } : tier))
      )
    )
  }, [])

  const addTier = useCallback(() => {
    setBoard((current) =>
      withTiers(current, [
        ...current.tiers,
        {
          id: newTierId(),
          label: String.fromCharCode(65 + current.tiers.length) || 'New',
          color: TIER_PALETTE[current.tiers.length % TIER_PALETTE.length],
          championIds: [],
        },
      ])
    )
  }, [])

  /** Dropping a row sends its champions back to the pool rather than deleting them. */
  const removeTier = useCallback((tierId: string) => {
    setBoard((current) =>
      current.tiers.length <= 1
        ? current
        : withTiers(
            current,
            current.tiers.filter((tier) => tier.id !== tierId)
          )
    )
  }, [])

  const updateTier = useCallback((tierId: string, patch: Partial<Omit<BoardTier, 'id'>>) => {
    setBoard((current) =>
      withTiers(
        current,
        current.tiers.map((tier) => (tier.id === tierId ? { ...tier, ...patch } : tier))
      )
    )
  }, [])

  const moveTier = useCallback((tierId: string, delta: number) => {
    setBoard((current) => {
      const from = current.tiers.findIndex((tier) => tier.id === tierId)
      const to = from + delta
      if (from === -1 || to < 0 || to >= current.tiers.length) return current
      const tiers = [...current.tiers]
      const [moved] = tiers.splice(from, 1)
      tiers.splice(to, 0, moved)
      return withTiers(current, tiers)
    })
  }, [])

  /** Set or clear one mark, dropping the champion's entry when nothing is left on it. */
  const applyTags = useCallback((championId: string, patch: Partial<typeof NO_TAGS>) => {
    setBoard((current) => {
      const next = { ...tagsOf(current, championId), ...patch }
      const tags = { ...current.tags }
      if (hasAnyTag(next)) tags[championId] = next
      else delete tags[championId]
      return { ...current, tags }
    })
  }, [])

  const toggleTag = useCallback((championId: string, key: TagKey) => {
    setBoard((current) => {
      const currentTags = tagsOf(current, championId)
      const next = { ...currentTags, [key]: !currentTags[key] }
      const tags = { ...current.tags }
      if (hasAnyTag(next)) tags[championId] = next
      else delete tags[championId]
      return { ...current, tags }
    })
  }, [])

  const setSignature = useCallback(
    (championId: string, signature: number) => applyTags(championId, { signature }),
    [applyTags]
  )

  const clearTags = useCallback((championId: string) => {
    setBoard((current) => {
      const tags = { ...current.tags }
      delete tags[championId]
      return { ...current, tags }
    })
  }, [])

  const setTitle = useCallback((title: string) => setBoard((c) => ({ ...c, title })), [])
  const replaceBoard = useCallback((next: BoardState) => setBoard(next), [])
  const resetBoard = useCallback(
    () => setBoard((current) => ({ ...defaultBoard(), id: current.id })),
    []
  )

  const actions = useMemo(
    () => ({
      moveChampion,
      clearTier,
      addTier,
      removeTier,
      updateTier,
      moveTier,
      toggleTag,
      setSignature,
      clearTags,
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
      toggleTag,
      setSignature,
      clearTags,
      setTitle,
      replaceBoard,
      resetBoard,
    ]
  )

  return { board, setBoard, actions }
}

export type BoardActions = ReturnType<typeof useBoard>['actions']

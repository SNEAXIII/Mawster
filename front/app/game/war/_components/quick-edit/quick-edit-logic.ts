import { parseRarity } from '@/app/game/defense/_components/defense-utils'
import { RARITIES } from '@/app/services/roster'
import type { WarPlacement } from '@/app/services/war'

/** The node slider always splits the map in this many slices: 50 → 10 nodes, 10 → 2. */
export const NODE_SLICES = 5

export type Range = [number, number]

/** What a row would record: the rank as an index into RARITIES. */
export interface Draft {
  championId: string
  rankIndex: number
  ascension: number
}

export function sliceNodes(nodeCount: number, [lo, hi]: Range): number[] {
  const size = nodeCount / NODE_SLICES
  const first = lo * size + 1
  return Array.from({ length: (hi - lo + 1) * size }, (_, i) => first + i)
}

/**
 * Whether a node holds a defender: what the quick edit last wrote there wins over the map,
 * which can lag behind until its reload lands. A failed write leaves the node as it was.
 */
export function createDefenderTracker() {
  const written = new Map<number, boolean>()
  return {
    placed: (node: number) => void written.set(node, true),
    removed: (node: number) => void written.set(node, false),
    holds: (node: number, onMap: boolean) => written.get(node) ?? onMap,
    /** Forgets every node except those `keep` still needs, e.g. a write in flight. */
    clear: (keep: (node: number) => boolean = () => false) => {
      for (const node of written.keys()) if (!keep(node)) written.delete(node)
    },
  }
}

/**
 * Runs a node's writes one after the other, whoever starts them: a dropdown or a
 * confirmation opened before the row locked cannot race the write in flight.
 */
export function createNodeChain() {
  const tails = new Map<number, Promise<void>>()
  return {
    run(node: number, task: () => Promise<void>): Promise<void> {
      const next = (tails.get(node) ?? Promise.resolve()).then(task).catch(() => {})
      tails.set(node, next)
      void next.then(() => {
        if (tails.get(node) === next) tails.delete(node)
      })
      return next
    },
    busy: (node: number) => tails.has(node),
  }
}

/** Where a quick-edit write goes, captured when it is started. */
export interface WriteTarget {
  allianceId: string
  warId: string
  bg: number
}

export const scopeOf = (target: WriteTarget) => `${target.warId}:${target.bg}`

/**
 * What a reopen keeps: on the same war and BG, the nodes still in flight; on another one,
 * nothing, since node numbers repeat from one BG to the next.
 */
export const keptOnReopen =
  (lastScope: string | null, scope: string, busy: (node: number) => boolean) => (node: number) =>
    lastScope === scope && busy(node)

/** The entries of `record` whose node `keep` accepts. */
export function keepNodes<T>(record: Record<number, T>, keep: (node: number) => boolean) {
  return Object.fromEntries(Object.entries(record).filter(([node]) => keep(Number(node))))
}

export const FULL_ASC_RANGE: Range = [0, 2]
export const FULL_RANK_RANGE: Range = [0, RARITIES.length - 1]

/** Reads a stored `[lo, hi]` within `full`; anything else falls back to `full`. */
export const parseRangeWithin =
  (full: Range) =>
  (raw: unknown): Range => {
    if (!Array.isArray(raw) || raw.length !== 2) return full
    if (!raw.every((n) => Number.isInteger(n) && n >= full[0] && n <= full[1])) return full
    return [Math.min(raw[0], raw[1]), Math.max(raw[0], raw[1])]
  }

export const clamp = (value: number, [lo, hi]: Range) => Math.min(Math.max(value, lo), hi)

/** A header range stretched so a row's current value stays reachable. */
export const widen = ([lo, hi]: Range, value: number): Range => [
  Math.min(lo, value),
  Math.max(hi, value),
]

export function rarityIndex(rarity: string): number {
  const { stars, rank } = parseRarity(rarity)
  return Math.max(0, RARITIES.indexOf(`${stars}r${rank}` as (typeof RARITIES)[number]))
}

export function draftOf(placement: WarPlacement): Draft {
  return {
    championId: placement.champion_id,
    rankIndex: rarityIndex(placement.rarity),
    ascension: placement.ascension,
  }
}

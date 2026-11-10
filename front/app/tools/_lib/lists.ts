import { normalizeBoard } from './board'
import { readStored, removeStored, writeStored } from './storage'
import type { BoardState } from './types'

/** How many tier lists one browser keeps. */
export const MAX_TIER_LISTS = 20

const LISTS = 'lists'
// The single board kept before every list moved to the browser; adopted once.
const LEGACY_BOARD = 'board'

type StoredList = BoardState & { id: string }

/** What the picker shows of a list: never its contents. */
export interface TierListSummary {
  id: string
  title: string
  ranked_champion_count: number
}

function isList(value: unknown): value is StoredList {
  const list = value as Partial<StoredList> | null
  return !!list && typeof list.id === 'string' && Array.isArray(list.tiers)
}

function writeLists(lists: StoredList[]): void {
  writeStored(LISTS, JSON.stringify(lists))
}

function parse(raw: string | null): unknown {
  try {
    return raw === null ? null : JSON.parse(raw)
  } catch {
    // Corrupted or hand-edited value: an empty shelf beats a blank screen.
    return null
  }
}

function adoptLegacyBoard(): StoredList[] {
  const legacy = parse(readStored(LEGACY_BOARD))
  const lists = legacy && typeof legacy === 'object' ? [{ ...legacy, id: crypto.randomUUID() }] : []
  const adopted = lists.filter(isList)
  if (adopted.length > 0) writeLists(adopted)
  removeStored(LEGACY_BOARD)
  return adopted
}

function readLists(): StoredList[] {
  const raw = readStored(LISTS)
  if (raw === null) return adoptLegacyBoard()
  const parsed = parse(raw)
  return Array.isArray(parsed) ? parsed.filter(isList) : []
}

export function listTierLists(): TierListSummary[] {
  return readLists().map((list) => ({
    id: list.id,
    title: typeof list.title === 'string' ? list.title : '',
    ranked_champion_count: list.tiers.reduce(
      (count, tier) => count + (Array.isArray(tier?.championIds) ? tier.championIds.length : 0),
      0
    ),
  }))
}

export function loadTierList(id: string, knownIds: Set<string>): BoardState | null {
  const found = readLists().find((list) => list.id === id)
  return found ? normalizeBoard(found, knownIds) : null
}

/** The new list's id, or null when the browser already holds the cap. */
export function createTierList(board: BoardState): string | null {
  const lists = readLists()
  if (lists.length >= MAX_TIER_LISTS) return null
  const id = crypto.randomUUID()
  writeLists([...lists, { ...board, id }])
  return id
}

export function saveTierList(board: StoredList): void {
  writeLists(readLists().map((list) => (list.id === board.id ? board : list)))
}

export function deleteTierList(id: string): void {
  writeLists(readLists().filter((list) => list.id !== id))
}

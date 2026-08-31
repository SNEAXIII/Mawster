import { CHAMPIONS_BY_ID } from '@/data/champions'
import type { AttributeKey, BoardState, ChampionAttributes, Tier } from './types'
import { FRAME_OPTIONS } from './types'

export const STORAGE_KEY = 'mawster-tierlist:board'

/** Classic tier-maker ramp, warm to cool. Reused when the user adds a tier. */
export const TIER_PALETTE = [
  '#ff7f7f',
  '#ffbf7f',
  '#ffdf7f',
  '#ffff7f',
  '#bfff7f',
  '#7fff7f',
  '#7fffff',
  '#7fbfff',
  '#bf7fff',
  '#ff7fff',
]

const DEFAULT_LABELS = ['S', 'A', 'B', 'C', 'D']

export function newTierId(): string {
  return `tier-${Math.random().toString(36).slice(2, 9)}`
}

export function defaultTiers(): Tier[] {
  return DEFAULT_LABELS.map((label, i) => ({
    id: newTierId(),
    label,
    color: TIER_PALETTE[i % TIER_PALETTE.length],
    championIds: [],
  }))
}

export function defaultBoard(): BoardState {
  return {
    version: 1,
    tiers: defaultTiers(),
    attributes: {},
    iconChoices: {},
    frame: '7',
    title: '',
  }
}

/**
 * Coerce anything that came out of localStorage or an imported file into a
 * usable board. Unknown champion ids are dropped and duplicates collapsed, so a
 * stale export (or one made before a champion was hard-banned) still loads
 * instead of leaving ghost cards that can never be moved.
 */
export function normalizeBoard(input: unknown): BoardState | null {
  if (!input || typeof input !== 'object') return null
  const raw = input as Partial<BoardState>
  if (!Array.isArray(raw.tiers)) return null

  const placed = new Set<string>()
  const tiers: Tier[] = raw.tiers
    .filter((t): t is Tier => !!t && typeof t === 'object' && typeof t.label === 'string')
    .map((t, i) => ({
      id: typeof t.id === 'string' && t.id ? t.id : newTierId(),
      label: t.label,
      color: typeof t.color === 'string' ? t.color : TIER_PALETTE[i % TIER_PALETTE.length],
      championIds: (Array.isArray(t.championIds) ? t.championIds : []).filter((id) => {
        if (typeof id !== 'string' || !CHAMPIONS_BY_ID.has(id) || placed.has(id)) return false
        placed.add(id)
        return true
      }),
    }))
  if (tiers.length === 0) return null

  const attributes: Record<string, ChampionAttributes> = {}
  const rawAttrs = raw.attributes
  if (rawAttrs && typeof rawAttrs === 'object') {
    for (const [id, value] of Object.entries(rawAttrs)) {
      if (!CHAMPIONS_BY_ID.has(id) || !value || typeof value !== 'object') continue
      const flags = (value as ChampionAttributes).flags
      const sig = (value as ChampionAttributes).sig
      attributes[id] = {
        flags: flags && typeof flags === 'object' ? flags : {},
        ...(typeof sig === 'number' && Number.isFinite(sig) ? { sig } : {}),
      }
    }
  }

  const frame = FRAME_OPTIONS.includes(raw.frame as never) ? raw.frame! : '7'
  const iconChoices =
    raw.iconChoices && typeof raw.iconChoices === 'object'
      ? (raw.iconChoices as Partial<Record<AttributeKey, string>>)
      : {}

  return {
    version: 1,
    tiers,
    attributes,
    iconChoices,
    frame,
    title: typeof raw.title === 'string' ? raw.title : '',
  }
}

export function loadBoard(): BoardState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultBoard()
    return normalizeBoard(JSON.parse(raw)) ?? defaultBoard()
  } catch {
    // Corrupted or unreadable storage (private mode, quota, hand-edited value):
    // a fresh board beats a blank screen.
    return defaultBoard()
  }
}

export function saveBoard(board: BoardState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(board))
  } catch {
    // Storage full or blocked — the board stays usable for this session.
  }
}

/** Champion ids sitting in a tier, i.e. everything the pool must not show. */
export function rankedIds(board: BoardState): Set<string> {
  return new Set(board.tiers.flatMap((t) => t.championIds))
}

export function attributesOf(board: BoardState, championId: string): ChampionAttributes {
  return board.attributes[championId] ?? { flags: {} }
}

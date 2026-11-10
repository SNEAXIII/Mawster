import { NO_TAGS, hasAnyTag, type BoardState, type BoardTier, type ChampionTags } from './types'

/** Classic tier-maker ramp, warm to cool. Reused when a row is added. */
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

/**
 * `crypto.randomUUID` rather than `Math.random`: the id is only a React key, but a
 * predictable generator in an identifier is a finding nobody should re-litigate.
 */
export function newTierId(): string {
  return `tier-${crypto.randomUUID()}`
}

export function defaultTiers(): BoardTier[] {
  return DEFAULT_LABELS.map((label, index) => ({
    id: newTierId(),
    label,
    color: TIER_PALETTE[index % TIER_PALETTE.length],
    championIds: [],
  }))
}

export function defaultBoard(): BoardState {
  return { id: null, title: '', tiers: defaultTiers(), tags: {} }
}

/**
 * Coerce anything read back from localStorage into a usable board. Champions the
 * catalog no longer holds are dropped and duplicates collapsed, so a board saved
 * before a champion was removed still loads instead of leaving cards that can
 * never be moved.
 */
export function normalizeBoard(input: unknown, knownIds: Set<string>): BoardState | null {
  if (!input || typeof input !== 'object') return null
  const raw = input as Partial<BoardState>
  if (!Array.isArray(raw.tiers)) return null

  const placed = new Set<string>()
  const tiers: BoardTier[] = raw.tiers
    .filter((tier): tier is BoardTier => !!tier && typeof tier.label === 'string')
    .map((tier, index) => ({
      id: typeof tier.id === 'string' && tier.id ? tier.id : newTierId(),
      label: tier.label,
      color:
        typeof tier.color === 'string' ? tier.color : TIER_PALETTE[index % TIER_PALETTE.length],
      championIds: (Array.isArray(tier.championIds) ? tier.championIds : []).filter((id) => {
        if (typeof id !== 'string' || !knownIds.has(id) || placed.has(id)) return false
        placed.add(id)
        return true
      }),
    }))
  if (tiers.length === 0) return null

  const tags: Record<string, ChampionTags> = {}
  if (raw.tags && typeof raw.tags === 'object') {
    for (const [championId, value] of Object.entries(raw.tags)) {
      if (!knownIds.has(championId) || !value || typeof value !== 'object') continue
      const merged = { ...NO_TAGS, ...(value as Partial<ChampionTags>) }
      if (hasAnyTag(merged)) tags[championId] = merged
    }
  }

  return {
    id: typeof raw.id === 'string' ? raw.id : null,
    title: typeof raw.title === 'string' ? raw.title : '',
    tiers,
    tags,
  }
}

/** Champion ids sitting in a row, i.e. everything the pool must not show. */
export function rankedIds(board: BoardState): Set<string> {
  return new Set(board.tiers.flatMap((tier) => tier.championIds))
}

export function tagsOf(board: BoardState, championId: string): ChampionTags {
  return board.tags[championId] ?? NO_TAGS
}

import { NO_TAGS, hasAnyTag } from './types'
import type { BoardState, ChampionTags } from './types'

/** Shape of a board written to a file. Versioned so a future one can be read. */
interface BoardExport {
  version: 1
  title: string
  tiers: { label: string; color: string; championIds: string[] }[]
  tags: Record<string, ChampionTags>
}

/**
 * A file name that sorts by date and says which board it came from.
 *
 * Its own rather than `hooks/use-image-export`'s `exportFilename`: that one
 * names a fixed screen ("knowledge-base"), this one carries a title the user
 * typed and has to be slugged.
 */
export function boardFilename(title: string, extension: string): string {
  const slug =
    title
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'tier-list'
  return `${slug}-${new Date().toISOString().slice(0, 10)}.${extension}`
}

/**
 * Write the board to a JSON file.
 *
 * Champion ids travel as they are: the file only reloads into this Mawster, so
 * there is no point carrying names that would have to be matched back.
 */
export function exportJson(board: BoardState): void {
  const payload: BoardExport = {
    version: 1,
    title: board.title,
    tiers: board.tiers.map((tier) => ({
      label: tier.label,
      color: tier.color,
      championIds: tier.championIds,
    })),
    tags: board.tags,
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = boardFilename(board.title, 'json')
  link.click()
  URL.revokeObjectURL(url)
}

/**
 * Read a board back from a file, keeping only champions the catalog still holds
 * and dropping duplicates — an export made before a champion was retired must
 * still load rather than leaving cards nothing can move.
 *
 * Returns null when the file is not one of ours; the caller says so.
 */
export async function importJson(
  file: File,
  knownIds: Set<string>
): Promise<Omit<BoardState, 'id'> | null> {
  let raw: unknown
  try {
    raw = JSON.parse(await file.text())
  } catch {
    return null
  }
  if (!raw || typeof raw !== 'object') return null
  const parsed = raw as Partial<BoardExport>
  if (!Array.isArray(parsed.tiers) || parsed.tiers.length === 0) return null

  const placed = new Set<string>()
  const tiers = parsed.tiers
    .filter((tier) => tier && typeof tier.label === 'string')
    .map((tier, index) => ({
      id: `imported-${index}`,
      label: tier.label,
      color: typeof tier.color === 'string' ? tier.color : '#ffffff',
      championIds: (Array.isArray(tier.championIds) ? tier.championIds : []).filter((id) => {
        if (typeof id !== 'string' || !knownIds.has(id) || placed.has(id)) return false
        placed.add(id)
        return true
      }),
    }))
  if (tiers.length === 0) return null

  const tags: Record<string, ChampionTags> = {}
  if (parsed.tags && typeof parsed.tags === 'object') {
    for (const [championId, value] of Object.entries(parsed.tags)) {
      if (!knownIds.has(championId) || !value || typeof value !== 'object') continue
      const merged = { ...NO_TAGS, ...(value as Partial<ChampionTags>) }
      if (hasAnyTag(merged)) tags[championId] = merged
    }
  }

  return { title: typeof parsed.title === 'string' ? parsed.title : '', tiers, tags }
}

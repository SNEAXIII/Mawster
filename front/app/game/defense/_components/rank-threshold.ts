import type { DefensePlacement } from '@/app/services/defense'
import { MAX_ASCENSION, RARITIES, rarityIndex } from '@/app/services/roster'
import type { SeasonFormat } from '@/app/services/season'
import { mapSectionsForFormat } from './war-format'

export const MIN_RANK_THRESHOLD = RARITIES.indexOf('7r1')
export const DEFAULT_RANK_THRESHOLD = RARITIES.indexOf('7r5')

export interface RankThresholdCounts {
  belowRank: number
  belowAscension: number
  unfilled: number
}

export interface RankThresholdReport {
  highlighted: Set<number>
  counts: RankThresholdCounts
}

const parseIndex =
  (min: number, max: number, fallback: number) =>
  (raw: unknown): number =>
    typeof raw === 'number' && Number.isInteger(raw) && raw >= min && raw <= max ? raw : fallback

export const parseRankThreshold = parseIndex(
  MIN_RANK_THRESHOLD,
  RARITIES.length - 1,
  DEFAULT_RANK_THRESHOLD
)
export const parseAscensionThreshold = parseIndex(0, MAX_ASCENSION, 0)

export function formatNodeNumbers(format: SeasonFormat): number[] {
  return mapSectionsForFormat(format)
    .flatMap((section) => section.rows.flat())
    .filter((node) => node !== 0)
}

/** `rank` is an index into RARITIES; a node counts under every cause it meets. */
export function rankThresholdReport(
  placements: DefensePlacement[],
  nodeNumbers: number[],
  rank: number,
  ascension: number
): RankThresholdReport {
  const byNode = new Map(placements.map((p) => [p.node_number, p]))
  const highlighted = new Set<number>()
  const counts: RankThresholdCounts = { belowRank: 0, belowAscension: 0, unfilled: 0 }
  const flag = (node: number, cause: keyof RankThresholdCounts) => {
    counts[cause]++
    highlighted.add(node)
  }
  for (const node of nodeNumbers) {
    const placement = byNode.get(node)
    if (!placement?.champion_user_id) {
      flag(node, 'unfilled')
      continue
    }
    if (rarityIndex(placement.rarity) < rank) flag(node, 'belowRank')
    if (placement.is_ascendable && placement.ascension < ascension) flag(node, 'belowAscension')
  }
  return { highlighted, counts }
}

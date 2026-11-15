import type { DefensePlacement } from '@/app/services/defense'
import { RARITIES, isAscension, rarityIndex } from '@/app/services/roster'
import type { SeasonFormat } from '@/app/services/season'
import { mapSectionsForFormat } from './war-format'

export const MIN_RANK_THRESHOLD = RARITIES.indexOf('7r1')
export const DEFAULT_RANK_THRESHOLD = RARITIES.indexOf('7r5')

export interface RankThresholdCounts {
  belowRank: number
  belowAscension: number
  unfilled: number
}

export const parseRankThreshold = (raw: unknown): number =>
  Number.isInteger(raw) &&
  (raw as number) >= MIN_RANK_THRESHOLD &&
  (raw as number) < RARITIES.length
    ? (raw as number)
    : DEFAULT_RANK_THRESHOLD
export const parseAscensionThreshold = (raw: unknown): number => (isAscension(raw) ? raw : 0)

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
) {
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

'use client'

import { useI18n } from '@/app/i18n'
import type { DefensePlacement } from '@/app/services/defense'
import { MAX_ASCENSION, RARITIES, RARITY_LABELS } from '@/app/services/roster'
import type { SeasonFormat } from '@/app/services/season'
import LabeledSlider from '@/components/labeled-slider'
import { useStoredValue } from '@/hooks/use-stored-value'
import {
  DEFAULT_RANK_THRESHOLD,
  MIN_RANK_THRESHOLD,
  formatNodeNumbers,
  parseAscensionThreshold,
  parseRankThreshold,
  rankThresholdReport,
} from './rank-threshold'

const CAUSES = ['belowRank', 'belowAscension', 'unfilled'] as const
const rankLabel = (index: number) => RARITY_LABELS[RARITIES[index]]

// ponytail: per-viewer localStorage, move to a stored alliance-level target if officers want one shared.
export function useRankThreshold(placements: DefensePlacement[], format: SeasonFormat) {
  const [rank, setRank] = useStoredValue(
    'defense-rank-threshold',
    parseRankThreshold,
    DEFAULT_RANK_THRESHOLD
  )
  const [ascension, setAscension] = useStoredValue(
    'defense-ascension-threshold',
    parseAscensionThreshold,
    0
  )
  const report = rankThresholdReport(placements, formatNodeNumbers(format), rank, ascension)
  return { rank, setRank, ascension, setAscension, ...report }
}

type RankThreshold = ReturnType<typeof useRankThreshold>

interface RankThresholdProps {
  threshold: RankThreshold
}

export default function RankThresholdBar({ threshold }: Readonly<RankThresholdProps>) {
  const { t } = useI18n()
  const labels = t.game.defense.rankThreshold
  const { rank, setRank, ascension, setAscension, counts } = threshold

  return (
    <div
      className='flex flex-wrap items-end gap-x-4 gap-y-2 border-b px-3 py-2'
      data-cy='rank-threshold-bar'
    >
      <LabeledSlider
        min={MIN_RANK_THRESHOLD}
        max={RARITIES.length - 1}
        value={[rank]}
        onChange={(next) => setRank(next[0])}
        format={rankLabel}
        cy='rank-threshold-rank'
        title={labels.rank}
      />
      <LabeledSlider
        max={MAX_ASCENSION}
        value={[ascension]}
        onChange={(next) => setAscension(next[0])}
        format={(level) => (level === 0 ? t.game.war.ascensionNone : `A${level}`)}
        cy='rank-threshold-ascension'
        title={labels.ascension}
      />
      <div className='flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground'>
        {CAUSES.map((cause) => (
          <span
            key={cause}
            data-cy={`rank-threshold-count-${cause}`}
          >
            <span className='font-semibold text-foreground tabular-nums'>{counts[cause]}</span>{' '}
            {labels[cause]}
          </span>
        ))}
      </div>
    </div>
  )
}

/** The export's stand-in for the bar: the highlight is never drawn on an exported map. */
export function RankThresholdLine({ threshold }: Readonly<RankThresholdProps>) {
  const { t } = useI18n()
  const line = t.game.defense.rankThreshold.exportLine
    .replace('{count}', String(threshold.counts.belowRank))
    .replace('{rank}', rankLabel(threshold.rank))

  return (
    <p
      className='mb-1 px-1 text-xs text-white'
      data-cy='rank-threshold-export-line'
    >
      {line}
    </p>
  )
}

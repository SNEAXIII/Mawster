'use client'

import LabeledSlider from '@/components/labeled-slider'
import { RARITIES, RARITY_LABELS } from '@/app/services/roster'
import type { RankRange } from '@/app/game/_components/use-rarity-filter'

interface RankRangeFilterProps {
  range: RankRange
  onChange: (next: RankRange) => void
  /** Short label shown before the slider (e.g. "Rank"). */
  label: string
  /** data-cy of the slider, e.g. "war-attacker-rarity". */
  cyPrefix: string
}

/** Two-thumb slider over the rarity ranks, from 6R4 to 7R6. */
export default function RankRangeFilter({
  range,
  onChange,
  label,
  cyPrefix,
}: Readonly<RankRangeFilterProps>) {
  return (
    <LabeledSlider
      max={RARITIES.length - 1}
      value={range}
      onChange={onChange}
      format={(i) => RARITY_LABELS[RARITIES[i]]}
      cy={cyPrefix}
      title={label}
    />
  )
}

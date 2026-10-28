'use client'

import { useI18n } from '@/app/i18n'
import LabeledSlider from '@/components/labeled-slider'
import RankRangeFilter from '@/app/game/_components/rank-range-filter'
import { NODE_SLICES, sliceNodes, type Range } from './quick-edit-logic'

interface QuickEditHeaderProps {
  nodeCount: number
  rankRange: Range
  onRankRange: (next: Range) => void
  ascRange: Range
  onAscRange: (next: Range) => void
  slices: Range
  onSlices: (next: Range) => void
}

/** Filters that bound the rows; none of them writes to the war. */
export default function QuickEditHeader(props: Readonly<QuickEditHeaderProps>) {
  const { nodeCount, rankRange, onRankRange, ascRange, onAscRange, slices, onSlices } = props
  const { t } = useI18n()
  const q = t.game.war.quickEdit
  const shown = sliceNodes(nodeCount, slices)

  return (
    <div className='flex flex-wrap items-end gap-6'>
      <RankRangeFilter
        range={rankRange}
        onChange={onRankRange}
        label={q.rankRange}
        cyPrefix='war-quick-edit-rank-range'
      />
      <LabeledSlider
        max={2}
        value={ascRange}
        onChange={onAscRange}
        format={(a) => (a === 0 ? t.game.war.ascensionNone : `A${a}`)}
        cy='war-quick-edit-asc-range'
        title={q.ascRange}
      />
      <LabeledSlider
        max={NODE_SLICES - 1}
        value={slices}
        onChange={onSlices}
        format={String}
        cy='war-quick-edit-nodes'
        title={q.nodes}
        valueSlot={
          <span
            className='text-xs text-muted-foreground tabular-nums'
            data-cy='war-quick-edit-nodes-value'
          >
            {shown[0]} – {shown.at(-1)}
          </span>
        }
      />
    </div>
  )
}

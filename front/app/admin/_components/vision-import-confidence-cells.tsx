'use client'

import { TableCell } from '@/components/ui/table'
import { cn } from '@/app/lib/utils'
import type { VisionImportRow } from '@/app/services/vision-stats'

const score = (ratio: number | null) => (ratio === null ? '—' : `${Math.round(ratio * 1000) / 10}%`)

interface VisionImportConfidenceCellsProps {
  row: VisionImportRow
}

export default function VisionImportConfidenceCells({
  row,
}: Readonly<VisionImportConfidenceCellsProps>) {
  const hasWorstCards = row.low_confidence_predictions > 0
  return (
    <>
      <TableCell
        className={cn('tabular-nums font-semibold', hasWorstCards && 'text-destructive')}
        data-cy='vision-imports-min-confidence'
      >
        {score(row.min_confidence)}
      </TableCell>
      <TableCell className='tabular-nums'>{score(row.avg_confidence)}</TableCell>
      <TableCell
        className={cn('tabular-nums', hasWorstCards && 'text-destructive')}
        data-cy='vision-imports-low-count'
      >
        {row.low_confidence_predictions}
      </TableCell>
    </>
  )
}

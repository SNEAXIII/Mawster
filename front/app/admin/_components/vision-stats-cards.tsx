'use client'

import { useI18n } from '@/app/i18n'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/app/lib/utils'
import type { VisionStatsOverview } from '@/app/services/vision-stats'

interface VisionStatsCardsProps {
  overview: VisionStatsOverview
}

const score = (ratio: number | null) => (ratio === null ? '—' : `${Math.round(ratio * 1000) / 10}%`)
const fill = (template: string, values: Record<string, string | number>) =>
  Object.entries(values).reduce(
    (text, [key, value]) => text.replace(`{{${key}}}`, String(value)),
    template
  )

export default function VisionStatsCards({ overview }: Readonly<VisionStatsCardsProps>) {
  const { t } = useI18n()
  const s = t.admin.visionStats

  // Hero numbers, not a chart: six single values with no shared scale have
  // nothing to compare against each other.
  const tiles = [
    {
      cy: 'imports',
      label: s.kpiImports,
      value: overview.imports_total,
      hint: fill(s.kpiImportsHint, { count: overview.imports_all_time }),
    },
    {
      cy: 'importers',
      label: s.kpiImporters,
      value: overview.distinct_users,
      hint: fill(s.kpiImportersHint, { count: overview.distinct_game_accounts }),
    },
    {
      cy: 'screens',
      label: s.kpiScreens,
      value: overview.screens_total,
      hint: fill(s.kpiScreensHint, { count: overview.avg_screens_per_import }),
    },
    {
      cy: 'min-confidence',
      label: s.kpiMinConfidence,
      value: score(overview.min_confidence),
      hint: fill(s.kpiMinConfidenceHint, { value: score(overview.avg_import_min_confidence) }),
      alert: true,
    },
    {
      cy: 'avg-confidence',
      label: s.kpiAvgConfidence,
      value: score(overview.avg_confidence),
      hint: fill(s.kpiAvgConfidenceHint, { count: overview.predictions_total }),
    },
    {
      cy: 'low-threshold',
      label: s.kpiLowThreshold,
      value: score(overview.low_confidence_threshold),
      hint: fill(s.kpiLowThresholdHint, { count: overview.low_confidence_predictions }),
    },
  ]

  return (
    <div
      className='grid grid-cols-2 gap-3 lg:grid-cols-4'
      data-cy='vision-stats-cards'
    >
      {tiles.map((tile) => (
        <Card
          key={tile.cy}
          data-cy={`vision-kpi-${tile.cy}`}
        >
          <CardContent className='p-4'>
            <p className='text-muted-foreground text-xs font-medium uppercase tracking-wide'>
              {tile.label}
            </p>
            <p
              className={cn(
                'mt-1 text-2xl font-semibold tabular-nums',
                tile.alert && 'text-destructive'
              )}
            >
              {tile.value}
            </p>
            <p className='text-muted-foreground mt-1 text-xs'>{tile.hint}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

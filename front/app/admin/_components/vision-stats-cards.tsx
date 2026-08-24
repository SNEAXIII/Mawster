'use client'

import { useI18n } from '@/app/i18n'
import { Card, CardContent } from '@/components/ui/card'
import type { VisionStatsOverview } from '@/app/services/vision-stats'

interface VisionStatsCardsProps {
  overview: VisionStatsOverview
}

const percent = (ratio: number) => `${Math.round(ratio * 1000) / 10}%`
const fill = (template: string, values: Record<string, string | number>) =>
  Object.entries(values).reduce(
    (text, [key, value]) => text.replace(`{{${key}}}`, String(value)),
    template
  )

export default function VisionStatsCards({ overview }: Readonly<VisionStatsCardsProps>) {
  const { t } = useI18n()
  const s = t.admin.visionStats

  // Hero numbers, not a chart: eight single values with no shared scale have
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
      cy: 'confirm-rate',
      label: s.kpiConfirmRate,
      value: percent(overview.confirm_rate),
      hint: fill(s.kpiConfirmRateHint, {
        confirmed: overview.imports_confirmed,
        cancelled: overview.imports_cancelled,
      }),
    },
    {
      cy: 'predictions',
      label: s.kpiPredictions,
      value: overview.predictions_total,
      hint: fill(s.kpiPredictionsHint, { count: overview.unidentified_predictions }),
    },
    {
      cy: 'job-failure',
      label: s.kpiJobFailure,
      value: percent(overview.job_failure_rate),
      hint: fill(s.kpiJobFailureHint, {
        failed: overview.jobs_failed,
        total: overview.jobs_total,
      }),
    },
    {
      cy: 'confidence',
      label: s.kpiConfidence,
      value: overview.avg_confidence === null ? '—' : percent(overview.avg_confidence),
      hint: fill(s.kpiConfidenceHint, { count: overview.reranked_predictions }),
    },
    {
      cy: 'shared',
      label: s.kpiShared,
      value: overview.shared_dataset_imports,
      hint: s.kpiSharedHint,
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
            <p className='mt-1 text-2xl font-semibold tabular-nums'>{tile.value}</p>
            <p className='text-muted-foreground mt-1 text-xs'>{tile.hint}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

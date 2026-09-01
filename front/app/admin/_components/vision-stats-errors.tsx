'use client'

import { useI18n } from '@/app/i18n'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { VisionJobError } from '@/app/services/vision-stats'

interface VisionStatsErrorsProps {
  errors: VisionJobError[]
}

export default function VisionStatsErrors({ errors }: Readonly<VisionStatsErrorsProps>) {
  const { t } = useI18n()
  const s = t.admin.visionStats

  // Ranked bars rather than a chart component: the labels are long free-form
  // error strings, and a bar per row with the label inline reads better than
  // any axis could.
  const worst = errors[0]?.count ?? 0

  return (
    <Card data-cy='vision-errors-panel'>
      <CardHeader className='pb-2'>
        <CardTitle className='text-base'>{s.errorsTitle}</CardTitle>
      </CardHeader>
      <CardContent>
        {errors.length === 0 ? (
          <p className='text-muted-foreground py-6 text-center text-sm'>{s.errorsNone}</p>
        ) : (
          <ul className='flex flex-col gap-3'>
            {errors.map((entry) => (
              <li
                key={entry.error}
                data-cy='vision-errors-row'
              >
                <div className='flex items-baseline justify-between gap-3 text-sm'>
                  <span className='truncate'>{entry.error}</span>
                  <span className='text-muted-foreground shrink-0 tabular-nums'>
                    {entry.count} {s.errorCount.toLowerCase()}
                  </span>
                </div>
                <div className='bg-muted mt-1 h-1.5 w-full overflow-hidden rounded-full'>
                  <div
                    className='bg-destructive h-full rounded-full'
                    style={{ width: `${worst ? (entry.count / worst) * 100 : 0}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

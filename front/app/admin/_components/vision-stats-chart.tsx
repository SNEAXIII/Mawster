'use client'

import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { useI18n } from '@/app/i18n'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import type { VisionDailyPoint } from '@/app/services/vision-stats'

interface VisionStatsChartProps {
  daily: VisionDailyPoint[]
}

// Two categorical hues, validated for both themes (lightness band, chroma
// floor, CVD separation and contrast against light and dark surfaces). Do not
// swap them for theme tokens: the pair has to hold in both modes at once.
const CONFIRMED_COLOR = '#3b82f6'
const OTHER_COLOR = '#d97706'

// A daily x-axis outgrows its labels fast: 30 `MM/DD` ticks already overlap
// into a smear at this card's width. Cap the labels and let recharts skip the
// rest — the bars still show every day, only the ticks thin out.
const MAX_TICK_LABELS = 10

export default function VisionStatsChart({ daily }: Readonly<VisionStatsChartProps>) {
  const { t } = useI18n()
  const s = t.admin.visionStats

  // Stacked, not two bars side by side: `confirmed` is a subset of `imports`,
  // so the stack height IS the import count and the split reads as an outcome.
  const data = useMemo(
    () =>
      daily.map((point) => ({
        day: point.day,
        confirmed: point.confirmed,
        other: Math.max(point.imports - point.confirmed, 0),
      })),
    [daily]
  )

  const config = {
    confirmed: { label: s.chartConfirmed, color: CONFIRMED_COLOR },
    other: { label: s.chartOther, color: OTHER_COLOR },
  } satisfies ChartConfig

  // recharts reads `interval` as "ticks to skip between labels", so 0 labels
  // every bucket.
  const tickInterval = Math.max(Math.ceil(data.length / MAX_TICK_LABELS) - 1, 0)
  const formatDay = (day: string) => day.slice(5).replace('-', '/')
  const hasData = data.some((point) => point.confirmed + point.other > 0)

  return (
    <Card data-cy='vision-stats-chart'>
      <CardHeader className='pb-2'>
        <CardTitle className='text-base'>{s.chartTitle}</CardTitle>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <ChartContainer
            config={config}
            className='aspect-auto h-64 w-full'
          >
            <BarChart
              data={data}
              margin={{ left: 4, right: 4, top: 4 }}
            >
              <CartesianGrid
                vertical={false}
                strokeDasharray='3 3'
              />
              <XAxis
                dataKey='day'
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                interval={tickInterval}
                tickFormatter={formatDay}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={32}
                allowDecimals={false}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              {/* Both segments carry the 4px top radius rather than only the
                  upper one: on a day where every import was confirmed the
                  `other` segment is absent, and a radius living solely there
                  would leave that day's bar square-topped. The corners of the
                  lower segment also read as the gap between the two. */}
              {/* No entrance animation: the whole dashboard re-queries on every
                  period change, and replaying a 1.5s grow each time reads as lag
                  rather than as polish. It also keeps the chart deterministic
                  for screenshots and E2E. */}
              <Bar
                dataKey='confirmed'
                stackId='imports'
                fill='var(--color-confirmed)'
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
              />
              <Bar
                dataKey='other'
                stackId='imports'
                fill='var(--color-other)'
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </ChartContainer>
        ) : (
          <p
            className='text-muted-foreground py-12 text-center text-sm'
            data-cy='vision-stats-chart-empty'
          >
            {s.chartEmpty}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

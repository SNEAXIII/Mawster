'use client'

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
import type { LoginBucket } from '@/app/services/login-stats'

export interface LoginChartPoint extends LoginBucket {
  label: string
}

interface LoginStatsChartProps {
  title: string
  points: LoginChartPoint[]
  dataCy: string
}

// Same validated categorical pair as vision-stats-chart: it has to hold in both themes at once.
const ACCOUNTS_COLOR = '#3b82f6'
const EVENTS_COLOR = '#d97706'
const MAX_TICK_LABELS = 12

export default function LoginStatsChart({ title, points, dataCy }: Readonly<LoginStatsChartProps>) {
  const { t } = useI18n()
  const s = t.admin.loginStats

  const config = {
    accounts: { label: s.seriesAccounts, color: ACCOUNTS_COLOR },
    events: { label: s.seriesEvents, color: EVENTS_COLOR },
  } satisfies ChartConfig

  const tickInterval = Math.max(Math.ceil(points.length / MAX_TICK_LABELS) - 1, 0)
  const hasData = points.some((point) => point.events > 0)

  return (
    <Card data-cy={dataCy}>
      <CardHeader className='pb-2'>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <ChartContainer
            config={config}
            className='aspect-auto h-64 w-full'
          >
            <BarChart
              data={points}
              margin={{ left: 4, right: 4, top: 4 }}
            >
              <CartesianGrid
                vertical={false}
                strokeDasharray='3 3'
              />
              <XAxis
                dataKey='label'
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                interval={tickInterval}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={32}
                allowDecimals={false}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar
                dataKey='accounts'
                fill='var(--color-accounts)'
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
              />
              <Bar
                dataKey='events'
                fill='var(--color-events)'
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </ChartContainer>
        ) : (
          <p
            className='text-muted-foreground py-12 text-center text-sm'
            data-cy={`${dataCy}-empty`}
          >
            {s.chartEmpty}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

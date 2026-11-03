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
  /** Above this many points, axis labels are thinned out. */
  maxTicks?: number
}

// Blue/amber is vision-stats-chart's pair; the two ambers share a stack, so they only need to part from each other.
const ACCOUNTS_COLOR = '#3b82f6'
const LOGINS_COLOR = '#d97706'
const REFRESHES_COLOR = '#fcd34d'

export default function LoginStatsChart({
  title,
  points,
  dataCy,
  maxTicks = 12,
}: Readonly<LoginStatsChartProps>) {
  const { t } = useI18n()
  const s = t.admin.loginStats

  const config = {
    accounts: { label: s.seriesAccounts, color: ACCOUNTS_COLOR },
    logins: { label: s.seriesLogins, color: LOGINS_COLOR },
    refreshes: { label: s.seriesRefreshes, color: REFRESHES_COLOR },
  } satisfies ChartConfig

  const tickInterval = Math.max(Math.ceil(points.length / maxTicks) - 1, 0)
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
                dataKey='logins'
                stackId='events'
                fill='var(--color-logins)'
                isAnimationActive={false}
              />
              <Bar
                dataKey='refreshes'
                stackId='events'
                fill='var(--color-refreshes)'
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

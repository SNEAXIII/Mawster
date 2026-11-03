'use client'

import { useMemo } from 'react'
import { useI18n } from '@/app/i18n'
import { cn } from '@/app/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useLoginStatsViewModel } from '../_viewmodels/use-login-stats-viewmodel'
import LoginStatsChart from './login-stats-chart'
import LoginStatsFilters from './login-stats-filters'

export default function LoginStatsPanel() {
  const { t, locale } = useI18n()
  const s = t.admin.loginStats
  const vm = useLoginStatsViewModel()

  const charts = useMemo(() => {
    if (!vm.stats) return null
    // Months arrive as `YYYY-MM`; formatted in UTC so the 1st never slips to the previous month.
    const monthFormat = new Intl.DateTimeFormat(locale, {
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    })
    const formatMonth = (month: string) => {
      const [year, monthIndex] = month.split('-').map(Number)
      return monthFormat.format(new Date(Date.UTC(year ?? 0, (monthIndex ?? 1) - 1, 1)))
    }
    return {
      month: vm.stats.by_month.map((p) => ({ ...p, label: formatMonth(p.month) })),
      weekday: vm.stats.by_weekday.map((p) => ({
        ...p,
        label: s.weekdays[p.weekday] ?? String(p.weekday),
      })),
      hour: vm.stats.by_hour.map((p) => ({ ...p, label: `${p.hour}h` })),
    }
  }, [vm.stats, locale, s.weekdays])

  if (vm.loading) {
    return <p className='text-muted-foreground py-12 text-center'>{t.common.loading}</p>
  }

  const totals = [
    {
      label: s.totalAccounts,
      value: vm.stats?.total_accounts,
      dataCy: 'login-stats-total-accounts',
    },
    { label: s.totalLogins, value: vm.stats?.total_logins, dataCy: 'login-stats-total-logins' },
    {
      label: s.totalRefreshes,
      value: vm.stats?.total_refreshes,
      dataCy: 'login-stats-total-refreshes',
    },
  ]

  return (
    <div
      className='flex flex-col gap-4'
      data-cy='login-stats-panel'
    >
      <div className='flex flex-wrap items-end justify-between gap-3'>
        <div>
          <h2 className='text-lg font-semibold'>{s.title}</h2>
          <p className='text-muted-foreground text-sm'>{s.subtitle}</p>
        </div>
        <LoginStatsFilters
          days={vm.days}
          onPeriodChange={vm.changePeriod}
          onRefresh={vm.reload}
        />
      </div>

      {vm.error || !charts ? (
        <div className='flex flex-col items-center gap-3 py-12'>
          <p className='text-destructive text-sm'>{s.loadError}</p>
          <Button
            variant='outline'
            onClick={vm.reload}
            data-cy='login-stats-retry'
          >
            {s.refresh}
          </Button>
        </div>
      ) : (
        <div
          className={cn('flex flex-col gap-4 transition-opacity', vm.refreshing && 'opacity-50')}
          aria-busy={vm.refreshing}
          data-cy='login-stats-charts'
        >
          <div className='grid gap-4 sm:grid-cols-3'>
            {totals.map((total) => (
              <Card key={total.dataCy}>
                <CardContent className='flex flex-col gap-1 pt-6'>
                  <span className='text-muted-foreground text-sm'>{total.label}</span>
                  <span
                    className='text-2xl font-semibold tabular-nums'
                    data-cy={total.dataCy}
                  >
                    {total.value}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>

          <LoginStatsChart
            title={s.chartMonth}
            points={charts.month}
            dataCy='login-stats-chart-month'
            maxTicks={13}
          />
          <div className='grid gap-4 lg:grid-cols-2'>
            <LoginStatsChart
              title={s.chartWeekday}
              points={charts.weekday}
              dataCy='login-stats-chart-weekday'
            />
            <LoginStatsChart
              title={s.chartHour}
              points={charts.hour}
              dataCy='login-stats-chart-hour'
            />
          </div>
        </div>
      )}
    </div>
  )
}

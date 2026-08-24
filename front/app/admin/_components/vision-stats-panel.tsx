'use client'

import { useI18n } from '@/app/i18n'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'
import {
  DEFAULT_PERIOD,
  PERIOD_OPTIONS,
  useVisionStatsViewModel,
} from '../_viewmodels/use-vision-stats-viewmodel'
import { ALL_TIME_DAYS } from '@/app/services/vision-stats'
import VisionStatsCards from './vision-stats-cards'
import VisionStatsChart from './vision-stats-chart'
import VisionStatsErrors from './vision-stats-errors'
import VisionStatsImports from './vision-stats-imports'
import VisionStatsUsers from './vision-stats-users'

export default function VisionStatsPanel() {
  const { t } = useI18n()
  const s = t.admin.visionStats
  const vm = useVisionStatsViewModel()

  const periodLabels: Record<number, string> = {
    7: s.period7,
    30: s.period30,
    90: s.period90,
    365: s.period365,
    [ALL_TIME_DAYS]: s.periodAll,
  }

  if (vm.loading) {
    return <p className='text-muted-foreground py-12 text-center'>{t.common.loading}</p>
  }

  if (vm.error || !vm.stats || !vm.users || !vm.imports) {
    return (
      <div className='flex flex-col items-center gap-3 py-12'>
        <p className='text-destructive text-sm'>{s.loadError}</p>
        <Button
          variant='outline'
          onClick={vm.reload}
          data-cy='vision-stats-retry'
        >
          {s.refresh}
        </Button>
      </div>
    )
  }

  return (
    <div
      className='flex flex-col gap-4'
      data-cy='vision-stats-panel'
    >
      <div className='flex flex-wrap items-end justify-between gap-3'>
        <div>
          <h2 className='text-lg font-semibold'>{s.title}</h2>
          <p className='text-muted-foreground text-sm'>{s.subtitle}</p>
        </div>
        {/* Filters in one row above the charts, and the period drives every
            panel below so the numbers can never describe different windows. */}
        <div className='flex flex-wrap items-center gap-2'>
          {PERIOD_OPTIONS.map((option) => (
            <Button
              key={option}
              size='sm'
              variant={vm.days === option ? 'default' : 'outline'}
              onClick={() => vm.changePeriod(option)}
              data-cy={`vision-period-${option || 'all'}`}
            >
              {periodLabels[option] ?? String(option ?? DEFAULT_PERIOD)}
            </Button>
          ))}
          <Button
            size='sm'
            variant='ghost'
            onClick={vm.reload}
            aria-label={s.refresh}
            data-cy='vision-stats-refresh'
          >
            <RefreshCw className='h-4 w-4' />
          </Button>
        </div>
      </div>

      <VisionStatsCards overview={vm.stats.overview} />

      <div className='grid gap-4 lg:grid-cols-3'>
        <div className='lg:col-span-2'>
          <VisionStatsChart daily={vm.stats.daily} />
        </div>
        <VisionStatsErrors errors={vm.stats.top_errors} />
      </div>

      <VisionStatsUsers
        data={vm.users}
        sortBy={vm.sortBy}
        sortOrder={vm.sortOrder}
        onSort={vm.toggleSort}
        onPageChange={vm.setUserPage}
        onSelectUser={vm.filterOnUser}
      />

      <VisionStatsImports
        data={vm.imports}
        statusFilter={vm.statusFilter}
        onStatusChange={vm.changeStatus}
        userFilter={vm.userFilter}
        onClearUser={() => vm.filterOnUser(null)}
        onPageChange={vm.setImportPage}
      />
    </div>
  )
}

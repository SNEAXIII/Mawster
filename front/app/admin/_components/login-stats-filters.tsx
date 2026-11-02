'use client'

import { RefreshCw } from 'lucide-react'
import { useI18n } from '@/app/i18n'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ALL_TIME_DAYS } from '@/app/services/vision-stats'
import { LOGIN_PERIOD_OPTIONS } from '../_viewmodels/use-login-stats-viewmodel'

interface LoginStatsFiltersProps {
  days: number
  onPeriodChange: (value: string) => void
  onRefresh: () => void
}

export default function LoginStatsFilters({
  days,
  onPeriodChange,
  onRefresh,
}: Readonly<LoginStatsFiltersProps>) {
  const { t } = useI18n()
  const s = t.admin.loginStats

  const periodLabels: Record<number, string> = {
    30: s.period30,
    90: s.period90,
    365: s.period365,
    [ALL_TIME_DAYS]: s.periodAll,
  }

  return (
    <div className='flex flex-wrap items-center gap-2'>
      <Select
        value={String(days)}
        onValueChange={onPeriodChange}
      >
        <SelectTrigger
          className='w-40'
          data-cy='login-stats-period'
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {LOGIN_PERIOD_OPTIONS.map((option) => (
            <SelectItem
              key={option}
              value={String(option)}
              data-cy={`login-stats-period-${option || 'all'}`}
            >
              {periodLabels[option]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        size='sm'
        variant='ghost'
        onClick={onRefresh}
        aria-label={s.refresh}
        data-cy='login-stats-refresh'
      >
        <RefreshCw className='h-4 w-4' />
      </Button>
    </div>
  )
}

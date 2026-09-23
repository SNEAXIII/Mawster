'use client'

import { Flame } from 'lucide-react'
import { useI18n } from '@/app/i18n'
import { cn } from '@/app/lib/utils'

export function WinStreakFlame({ streak }: Readonly<{ streak: number }>) {
  const { t } = useI18n()
  const label = t.profile.statistics.winStreak.replace('{count}', String(streak))
  const lit = streak > 0
  return (
    <div
      className='relative flex size-10 shrink-0 items-center justify-center'
      title={label}
      aria-label={label}
      role='img'
      data-cy='profile-win-streak'
    >
      <Flame
        aria-hidden
        className={cn(
          'size-10',
          lit ? 'fill-orange-500 text-orange-500' : 'fill-muted text-muted-foreground'
        )}
      />
      <span
        className={cn(
          'absolute inset-x-0 bottom-1.5 text-center text-xs font-bold tabular-nums',
          lit ? 'text-white' : 'text-muted-foreground'
        )}
        data-cy='profile-win-streak-count'
      >
        {streak}
      </span>
    </div>
  )
}

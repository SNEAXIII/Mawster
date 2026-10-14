'use client'

import { ShieldAlert, UserX } from 'lucide-react'
import { useI18n } from '@/app/i18n'
import { cn } from '@/app/lib/utils'
import type { UnrecordedReason } from '@/app/services/war'

const STYLE: Record<UnrecordedReason, { icon: typeof ShieldAlert; tone: string }> = {
  on_defense: { icon: ShieldAlert, tone: 'bg-amber-500/15 text-amber-500 border-amber-500/40' },
  not_in_roster: { icon: UserX, tone: 'bg-sky-500/15 text-sky-500 border-sky-500/40' },
}

export default function UnrecordedBadge({
  reason,
  compact = false,
}: Readonly<{ reason: UnrecordedReason; compact?: boolean }>) {
  const { t } = useI18n()
  const u = t.game.war.unrecorded
  const label = reason === 'on_defense' ? u.onDefense : u.notInRoster
  const hint = reason === 'on_defense' ? u.onDefenseHint : u.notInRosterHint
  const { icon: Icon, tone } = STYLE[reason]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded border font-medium',
        tone,
        compact ? 'px-1 text-[9px]' : 'px-1.5 py-0.5 text-[10px]'
      )}
      title={hint}
      data-cy={`unrecorded-badge-${reason}`}
    >
      <Icon className={compact ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
      {label}
    </span>
  )
}

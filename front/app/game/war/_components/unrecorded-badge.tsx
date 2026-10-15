'use client'

import { RefreshCw, ShieldAlert, UserX } from 'lucide-react'
import { useI18n } from '@/app/i18n'
import { cn } from '@/app/lib/utils'
import type { UnrecordedReason } from '@/app/services/war'

const STYLE = {
  on_defense: {
    icon: ShieldAlert,
    tone: 'bg-amber-500/15 text-amber-500 border-amber-500/40',
    label: 'onDefense',
    hint: 'onDefenseHint',
  },
  not_in_roster: {
    icon: UserX,
    tone: 'bg-sky-500/15 text-sky-500 border-sky-500/40',
    label: 'notInRoster',
    hint: 'notInRosterHint',
  },
  recorded_copy_free: {
    icon: RefreshCw,
    tone: 'bg-rose-500/15 text-rose-500 border-rose-500/40',
    label: 'recordedCopyFree',
    hint: 'recordedCopyFreeHint',
  },
} as const satisfies Record<UnrecordedReason, object>

export default function UnrecordedBadge({
  reason,
  compact = false,
}: Readonly<{ reason: UnrecordedReason; compact?: boolean }>) {
  const { t } = useI18n()
  const u = t.game.war.unrecorded
  const { icon: Icon, tone, label: labelKey, hint: hintKey } = STYLE[reason]
  const label = u[labelKey]
  const hint = u[hintKey]
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

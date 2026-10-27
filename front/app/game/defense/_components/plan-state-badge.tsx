'use client'

import { useI18n } from '@/app/i18n'
import { Badge } from '@/components/ui/badge'
import type { DefensePlanSummary } from '@/app/services/defense'

function stateClass(plan: DefensePlanSummary) {
  if (plan.state === 'validated') return 'border-green-500/40 bg-green-500/15 text-green-500'
  return plan.is_active
    ? 'border-destructive/40 bg-destructive/15 text-destructive'
    : 'border-amber-500/40 bg-amber-500/15 text-amber-500'
}

export interface PlanProgress {
  assigned: number
  total: number
}

interface PlanStateBadgeProps {
  plan: DefensePlanSummary
  progress?: PlanProgress
}

export default function PlanStateBadge({ plan, progress }: Readonly<PlanStateBadgeProps>) {
  const { t } = useI18n()
  const p = t.game.defense.plans
  return (
    <span className='flex items-center gap-1'>
      <Badge
        variant='outline'
        className={`gap-1.5 ${stateClass(plan)}`}
        data-cy='plan-state-badge'
        data-state={plan.state}
      >
        {plan.state === 'validated' ? p.validated : p.incomplete}
        {progress && (
          <span
            className='border-l border-current/30 pl-1.5 tabular-nums'
            data-cy='plan-state-progress'
          >
            {progress.assigned}/{progress.total}
          </span>
        )}
      </Badge>
      {plan.is_active && (
        <Badge
          className='bg-green-600 text-white hover:bg-green-600/80'
          data-cy='plan-active-badge'
        >
          {p.active}
        </Badge>
      )}
    </span>
  )
}

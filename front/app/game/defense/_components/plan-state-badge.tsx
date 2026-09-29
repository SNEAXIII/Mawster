'use client'

import { useI18n } from '@/app/i18n'
import { Badge } from '@/components/ui/badge'
import type { DefensePlanSummary } from '@/app/services/defense'

function stateVariant(plan: DefensePlanSummary) {
  if (plan.state === 'validated') return 'default'
  return plan.is_active ? 'destructive' : 'secondary'
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
        variant={stateVariant(plan)}
        data-cy='plan-state-badge'
      >
        {plan.state === 'validated' ? p.validated : p.incomplete}
        {progress && (
          <>
            {' · '}
            <span data-cy='plan-state-progress'>
              {progress.assigned}/{progress.total}
            </span>
          </>
        )}
      </Badge>
      {plan.is_active && <Badge data-cy='plan-active-badge'>{p.active}</Badge>}
    </span>
  )
}

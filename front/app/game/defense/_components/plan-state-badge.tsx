'use client'

import { useI18n } from '@/app/i18n'
import { Badge } from '@/components/ui/badge'
import type { DefensePlanSummary } from '@/app/services/defense'

export default function PlanStateBadge({ plan }: Readonly<{ plan: DefensePlanSummary }>) {
  const { t } = useI18n()
  const p = t.game.defense.plans
  return (
    <span className='flex items-center gap-1'>
      <Badge
        variant={plan.state === 'validated' ? 'default' : 'secondary'}
        data-cy='plan-state-badge'
      >
        {plan.state === 'validated' ? p.validated : p.pending}
      </Badge>
      {plan.is_active && <Badge data-cy='plan-active-badge'>{p.active}</Badge>}
      {plan.is_incomplete && (
        <Badge
          variant='destructive'
          data-cy='plan-incomplete-badge'
        >
          {p.incomplete}
        </Badge>
      )}
    </span>
  )
}

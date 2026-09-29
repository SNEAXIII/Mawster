'use client'

import { FiPlus } from 'react-icons/fi'
import { Button } from '@/components/ui/button'
import type { Quota } from '@/app/services/defense'
import QuotaTooltip from './quota-tooltip'

interface QuotaCreateButtonProps {
  label: string
  quota: Quota
  reachedText: string
  onClick: () => void
  dataCy: string
}

export default function QuotaCreateButton({
  label,
  quota,
  reachedText,
  onClick,
  dataCy,
}: Readonly<QuotaCreateButtonProps>) {
  const full = quota.used >= quota.limit
  return (
    <QuotaTooltip
      full={full}
      reachedText={reachedText}
      limit={quota.limit}
    >
      <Button
        size='sm'
        onClick={onClick}
        disabled={full}
        data-cy={`${dataCy}-create-btn`}
      >
        <FiPlus />
        {label}
        <span
          className='rounded text-xs tabular-nums'
          data-cy={`${dataCy}-quota`}
        >
          {quota.used}/{quota.limit}
        </span>
      </Button>
    </QuotaTooltip>
  )
}

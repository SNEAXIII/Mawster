'use client'

import { FiPlus } from 'react-icons/fi'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { Quota } from '@/app/services/defense'

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
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span>
            <Button
              size='sm'
              onClick={onClick}
              disabled={full}
              data-cy={`${dataCy}-create-btn`}
            >
              <FiPlus className='mr-1' />
              {label} ·{' '}
              <span data-cy={`${dataCy}-quota`}>
                {quota.used}/{quota.limit}
              </span>
            </Button>
          </span>
        </TooltipTrigger>
        {full && (
          <TooltipContent>{reachedText.replace('{limit}', String(quota.limit))}</TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  )
}

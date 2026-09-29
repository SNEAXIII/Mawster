'use client'

import type { ReactNode } from 'react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface QuotaTooltipProps {
  full: boolean
  reachedText: string
  limit: number
  children: ReactNode
}

export default function QuotaTooltip({
  full,
  reachedText,
  limit,
  children,
}: Readonly<QuotaTooltipProps>) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span>{children}</span>
        </TooltipTrigger>
        {full && <TooltipContent>{reachedText.replace('{limit}', String(limit))}</TooltipContent>}
      </Tooltip>
    </TooltipProvider>
  )
}

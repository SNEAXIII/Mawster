'use client'

import { useRef, type MouseEvent } from 'react'
import { toast } from 'sonner'
import { FiFlag } from 'react-icons/fi'
import { useI18n } from '@/app/i18n'
import { cn } from '@/app/lib/utils'
import { Button } from '@/components/ui/button'
import { useRequestedAscensions } from '@/hooks/use-requested-ascensions'

interface AscensionRequestButtonProps {
  championId: string
  variant: 'icon' | 'text' | 'bar'
}

export default function AscensionRequestButton({
  championId,
  variant,
}: Readonly<AscensionRequestButtonProps>) {
  const { t } = useI18n()
  const { isRequested, request } = useRequestedAscensions()
  const pending = useRef(false)
  const requested = isRequested(championId)
  const { request: requestLabel, requested: requestedLabel } = t.champions.ascensionRequest
  const label = requested ? requestedLabel : requestLabel

  const onClick = async (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    if (pending.current) return
    pending.current = true
    try {
      await request(championId)
      toast.success(t.champions.ascensionRequest.sent)
    } catch {
      toast.error(t.champions.ascensionRequest.error)
    } finally {
      pending.current = false
    }
  }

  const shared = {
    onClick,
    disabled: requested,
    title: label,
    'aria-label': label,
    'data-cy': 'ascension-request-button',
    'data-requested': requested ? 'true' : 'false',
  }

  if (variant === 'icon') {
    return (
      <Button
        type='button'
        variant='ghost'
        size='icon'
        className='disabled:pointer-events-auto disabled:hover:bg-transparent'
        {...shared}
      >
        <FiFlag />
      </Button>
    )
  }

  const isBar = variant === 'bar'
  return (
    <button
      type='button'
      className={cn(
        'inline-flex items-center gap-1 rounded p-0.5 transition-colors enabled:hover:text-amber-300 disabled:opacity-50',
        isBar ? 'text-white/50' : 'text-xs text-muted-foreground'
      )}
      {...shared}
    >
      <FiFlag className='size-3.5' />
      {!isBar && label}
    </button>
  )
}

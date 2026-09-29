'use client'

import type { ReactNode } from 'react'
import { cn } from '@/app/lib/utils'

interface ToggleButtonProps {
  active: boolean
  onClick: () => void
  dataCy?: string
  children: ReactNode
}

export function ToggleButton({ active, onClick, dataCy, children }: Readonly<ToggleButtonProps>) {
  return (
    <button
      type='button'
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1 rounded text-sm font-semibold whitespace-nowrap transition-colors',
        active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'
      )}
      data-cy={dataCy}
    >
      {children}
    </button>
  )
}

export function ToggleGroup({
  dataCy,
  children,
}: Readonly<{ dataCy?: string; children: ReactNode }>) {
  return (
    <div
      className='flex gap-1 rounded-md border p-1'
      data-cy={dataCy}
    >
      {children}
    </div>
  )
}

'use client'

import type { ReactNode } from 'react'
import { cn } from '@/app/lib/utils'

interface ToggleButtonProps {
  active: boolean
  onClick: () => void
  dataCy?: string
  /** Replaces the default primary colours of the active button */
  activeClassName?: string
  className?: string
  children: ReactNode
}

export function ToggleButton({
  active,
  onClick,
  dataCy,
  activeClassName = 'bg-primary text-primary-foreground',
  className,
  children,
}: Readonly<ToggleButtonProps>) {
  return (
    <button
      type='button'
      onClick={active ? undefined : onClick}
      aria-pressed={active}
      data-active={active || undefined}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1 rounded text-sm font-semibold whitespace-nowrap transition-colors',
        active ? cn(activeClassName, 'cursor-default') : 'text-muted-foreground hover:bg-accent',
        className
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

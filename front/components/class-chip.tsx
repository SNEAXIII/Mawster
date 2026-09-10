'use client'

import React from 'react'
import { cn } from '@/app/lib/utils'
import { getClassColors } from '@/app/lib/champion-class'
import { ClassIcon } from '@/components/class-icon'

const SIZES = {
  sm: { text: 'text-[9px]', icon: 11, gap: 'gap-0.5', pad: 'px-1 py-0.5' },
  md: { text: 'text-xs', icon: 14, gap: 'gap-1', pad: 'px-1.5 py-0.5' },
} as const

type ClassChipProps = Readonly<{
  championClass: string
  size?: keyof typeof SIZES
  /** 'pill' adds a tinted background and border — for tables and standalone badges. */
  variant?: 'text' | 'pill'
  className?: string
  dataCy?: string
}>

/** Class symbol + name, tinted with the class colour. */
export function ClassChip({
  championClass,
  size = 'md',
  variant = 'text',
  className,
  dataCy,
}: ClassChipProps) {
  const { text, icon, gap, pad } = SIZES[size]
  const { label, border } = getClassColors(championClass)
  return (
    <span
      className={cn(
        'inline-flex items-center font-medium leading-none',
        gap,
        text,
        label,
        variant === 'pill' && cn('rounded-md border bg-current/10', border, pad),
        className
      )}
      data-cy={dataCy ?? `class-chip-${championClass}`}
    >
      <ClassIcon
        championClass={championClass}
        size={icon}
      />
      {championClass}
    </span>
  )
}

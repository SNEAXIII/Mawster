'use client'

import React, { useState } from 'react'
import { cn } from '@/app/lib/utils'
import { getClassColors, getClassIconUrl } from '@/app/lib/champion-class'

/** Icons that 404'd once — shared across instances so a whole roster retries nothing. */
const missingIcons = new Set<string>()

type ClassIconProps = Readonly<{
  championClass: string
  /** Square size in px (default 14, sized for a filter row) */
  size?: number
  className?: string
}>

/**
 * Class symbol from the static server, falling back to a dot in the class colour
 * while the artwork is missing. Always decorative — pair it with the class name.
 */
export function ClassIcon({ championClass, size = 14, className }: ClassIconProps) {
  const url = getClassIconUrl(championClass)
  const [broken, setBroken] = useState(() => (url ? missingIcons.has(url) : true))

  if (!url || broken) {
    return (
      <span
        aria-hidden
        data-cy={`class-dot-${championClass}`}
        className={cn(
          'inline-block shrink-0 rounded-full',
          getClassColors(championClass).bg,
          className
        )}
        style={{ width: size * 0.7, height: size * 0.7 }}
      />
    )
  }

  return (
    <img
      src={url}
      alt=''
      aria-hidden
      data-cy={`class-icon-${championClass}`}
      loading='lazy'
      decoding='async'
      width={size}
      height={size}
      className={cn('inline-block shrink-0 object-contain', className)}
      style={{ width: size, height: size }}
      onError={() => {
        missingIcons.add(url)
        setBroken(true)
      }}
    />
  )
}

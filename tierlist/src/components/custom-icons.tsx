import type { SVGProps } from 'react'

/**
 * Icons Heroicons does not ship (sword, crossed swords, medal, gem, versus).
 * Solid style, 24x24 viewBox and `currentColor` so they drop into the same
 * slots as `@heroicons/react/24/solid` without any per-icon styling.
 */
type IconProps = SVGProps<SVGSVGElement>

const base = { viewBox: '0 0 24 24', fill: 'currentColor', 'aria-hidden': true } as const

export function SwordIcon(props: IconProps) {
  return (
    <svg
      {...base}
      {...props}
    >
      {/* Diagonal blade — a vertical one collapses into an exclamation mark at badge size. */}
      <path d='M17.1 2.2h4.7v4.7l-8.2 8.2-4.7-4.7 8.2-8.2Z' />
      {/* Cross-guard, perpendicular to the blade */}
      <path d='M9.1 8.9 15.1 14.9 13.4 16.6 7.4 10.6Z' />
      <path d='M12 13.5 9.5 15.9 8.1 14.5 10.5 12Z' />
      <circle
        cx='7.6'
        cy='16.4'
        r='1.9'
      />
    </svg>
  )
}

export function CrossedSwordsIcon(props: IconProps) {
  return (
    <svg
      {...base}
      {...props}
    >
      <path d='M21.8 2.2h-3.4L2.7 17.9l3.4 3.4L21.8 5.6V2.2Z' />
      <path d='M2.2 2.2h3.4L21.3 17.9l-3.4 3.4L2.2 5.6V2.2Z' />
      {/* Cross-guards near the grips — without them the two blades read as a plain X. */}
      <path d='M3.5 16.3 7.7 20.5 6.5 21.7 2.3 17.5Z' />
      <path d='M20.5 16.3 16.3 20.5 17.5 21.7 21.7 17.5Z' />
    </svg>
  )
}

export function SwordShieldIcon(props: IconProps) {
  return (
    <svg
      {...base}
      {...props}
    >
      {/* shield, lower left */}
      <path d='M5.7 8 1 9.8v4.6c0 3.3 1.9 6.2 4.7 7.2 2.8-1 4.7-3.9 4.7-7.2V9.8L5.7 8Z' />
      {/* sword, upper right */}
      <path d='M23 1.4h-3.1l-8.5 8.5 3.1 3.1 8.5-8.5V1.4Z' />
      <path d='M11.5 8.8 15.7 13 14.5 14.2 10.3 10Z' />
    </svg>
  )
}

export function MedalIcon(props: IconProps) {
  return (
    <svg
      {...base}
      {...props}
    >
      <path d='M8.5 1.5H4.6l4.3 6.6a8 8 0 0 1 2.6-1.1L8.5 1.5Z' />
      <path d='M15.5 1.5h3.9l-4.3 6.6a8 8 0 0 0-2.6-1.1L15.5 1.5Z' />
      {/* Disc with the star punched out, so the star stays visible at badge size. */}
      <path
        fillRule='evenodd'
        clipRule='evenodd'
        d='M12 7.6a7.3 7.3 0 1 0 0 14.6 7.3 7.3 0 0 0 0-14.6Zm0 2.5 1.6 3.3 3.6.5-2.6 2.6.6 3.6-3.2-1.7-3.2 1.7.6-3.6-2.6-2.6 3.6-.5L12 10.1Z'
      />
    </svg>
  )
}

export function GemIcon(props: IconProps) {
  return (
    <svg
      {...base}
      {...props}
    >
      <path d='M7.4 2.4h9.2l4.6 6.1L12 22 2.2 8.5l5.2-6.1Zm.9 2.3L5.1 8.4h4.1l1-3.7H8.3Zm3.1 0-1 3.7h3.2l-1-3.7h-1.2Zm3.3 0h-1l1 3.7h4.2l-3.2-3.7h-1ZM5.6 10.7l4.6 6.4-1.8-6.4H5.6Zm5.1 0 1.3 4.6 1.3-4.6h-2.6Zm4.6 0-1.8 6.4 4.6-6.4h-2.8Z' />
    </svg>
  )
}

export function VersusIcon(props: IconProps) {
  return (
    <svg
      {...base}
      {...props}
    >
      <path d='M2.2 3.4h3.3l2.4 8.2 2.4-8.2h3.3L9.5 20.6H6.3L2.2 3.4Z' />
      <path d='M21.8 7.9h-3.1c0-.9-.6-1.4-1.6-1.4-.9 0-1.5.4-1.5 1.1 0 .8.6 1.1 2.2 1.6 2.6.7 4 1.7 4 4 0 2.7-2.1 4.4-5 4.4-3 0-5-1.7-5-4.6h3.2c0 1.2.7 1.8 1.9 1.8 1 0 1.7-.4 1.7-1.2 0-.8-.6-1.2-2.3-1.6-2.5-.7-3.9-1.8-3.9-4 0-2.6 2-4.2 4.8-4.2 2.9 0 4.6 1.6 4.6 4.1Z' />
    </svg>
  )
}

export function FlameIcon(props: IconProps) {
  return (
    <svg
      {...base}
      {...props}
    >
      <path d='M13.2 1.3c.6 3.1-.4 5.1-2 6.8-1.9 2-4.4 3.7-4.4 7.3a7.2 7.2 0 0 0 14.4 0c0-2.9-1.5-4.7-2.9-6.3-.3 1-1 1.8-1.9 2.1.6-3.6-1-7.3-3.2-9.9ZM12 21a3.4 3.4 0 0 1-3.4-3.4c0-1.7 1.2-2.6 2.1-3.5.6.9 1.6 1.4 2.4 1.1.4 1.2 2.3 1.9 2.3 3.6A3.4 3.4 0 0 1 12 21Z' />
    </svg>
  )
}

export function ShieldIcon(props: IconProps) {
  return (
    <svg
      {...base}
      {...props}
    >
      <path d='M12 1.4 3 4.9v6.6c0 5 3.7 9.7 9 11.1 5.3-1.4 9-6.1 9-11.1V4.9L12 1.4Z' />
    </svg>
  )
}

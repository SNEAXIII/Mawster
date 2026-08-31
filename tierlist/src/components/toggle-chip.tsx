import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface ToggleChipProps {
  on: boolean
  onToggle: () => void
  children: ReactNode
  title?: string
  /** Extra classes applied when the chip is on — see `ATTRIBUTES[x].accent`. */
  accent?: string
  className?: string
}

/** Small on/off pill used by every filter row. */
export default function ToggleChip({
  on,
  onToggle,
  children,
  title,
  accent,
  className,
}: Readonly<ToggleChipProps>) {
  return (
    <button
      type='button'
      onClick={onToggle}
      aria-pressed={on}
      title={title}
      data-on={on}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-border bg-elevated px-2.5 py-1',
        'text-xs font-semibold text-muted-foreground transition-colors',
        'hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        accent,
        className
      )}
    >
      {children}
    </button>
  )
}

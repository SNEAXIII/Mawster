'use client'

import { cn } from '@/app/lib/utils'

interface NodeSlotProps {
  nodeNumber: number
  /** full: larger type, matching the row's `full` mode */
  isFull?: boolean
  title?: string
}

/**
 * Fixed-width left column holding the node number.
 * War rows pack a variable number of portraits (prefights, assist) next to a
 * fixed set of controls, so the node has its own slot: it stays readable and
 * aligned across every row type instead of being squeezed out in between.
 */
export default function NodeSlot({ nodeNumber, isFull = false, title }: Readonly<NodeSlotProps>) {
  return (
    <div
      className={cn(
        'shrink-0 tabular-nums text-muted-foreground',
        isFull ? 'w-9 text-xs' : 'w-6 text-[10px]'
      )}
      title={title}
      data-cy={`node-slot-${nodeNumber}`}
    >
      #{nodeNumber}
    </div>
  )
}

'use client'

import { type ReactNode, useState } from 'react'
import { cn } from '@/app/lib/utils'
import { Slider } from '@/components/ui/slider'

interface LabeledSliderProps<T extends number[]> {
  max: number
  /** One value draws a single thumb, two draw a range. */
  value: T
  onChange: (next: T) => void
  format: (i: number) => string
  cy: string
  disabled?: boolean
  className?: string
  /** Field name shown left of the value. */
  title?: ReactNode
  /** Replaces the value text, e.g. an input for exact values. */
  valueSlot?: ReactNode
}

export default function LabeledSlider<T extends number[]>({
  max,
  value,
  onChange,
  format,
  cy,
  disabled,
  className,
  title,
  valueSlot,
}: Readonly<LabeledSliderProps<T>>) {
  // Dragging only moves the draft; the value changes on release so the API isn't hit per step.
  const [draft, setDraft] = useState<number[] | null>(null)
  const shown = draft ?? value
  const [lo, hi = lo] = shown

  return (
    <div
      className={cn('flex w-36 flex-col gap-1', className)}
      data-cy={cy}
    >
      <div className='flex items-center justify-between gap-2'>
        {title}
        {valueSlot ?? (
          <span
            className='text-xs text-muted-foreground tabular-nums'
            data-cy={`${cy}-value`}
          >
            {lo === hi ? format(lo) : `${format(lo)} – ${format(hi)}`}
          </span>
        )}
      </div>
      <Slider
        min={0}
        max={max}
        step={1}
        value={shown}
        disabled={disabled}
        onValueChange={setDraft}
        onValueCommit={(next) => {
          setDraft(null)
          onChange(next as T)
        }}
      />
    </div>
  )
}

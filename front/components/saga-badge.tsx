'use client'

import { cn } from '@/app/lib/utils'
import { useExportMode } from '@/app/contexts/export-mode-context'

export default function SagaBadge({
  additionalClasses = '',
  size,
}: Readonly<{ additionalClasses?: string; size: number }>) {
  const exporting = useExportMode()
  // 32px asset on screen, 128px original while exporting (same artwork).
  const src = exporting ? '/static/frame/current_saga.png' : '/static/frame/current_saga_mini.png'
  return (
    <div
      className={cn(
        'absolute top-1/2 -translate-y-1/2 flex items-center justify-center',
        additionalClasses
      )}
      style={{ left: -Math.round(size / 2.5) }}
      data-cy='saga-badge'
    >
      <img
        src={src}
        alt=''
        width={size}
        height={size}
      ></img>
    </div>
  )
}

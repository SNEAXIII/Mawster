import type { ReactNode } from 'react'
import { cn } from '@/app/lib/utils'

/** Page-level title: the top of the type scale, with the accent bar of the visual identity. */
export function PageTitle({
  children,
  className,
}: Readonly<{ children: ReactNode; className?: string }>) {
  return (
    <h1
      className={cn(
        'border-l-2 border-primary pl-3 text-2xl font-semibold tracking-tight',
        className
      )}
    >
      {children}
    </h1>
  )
}

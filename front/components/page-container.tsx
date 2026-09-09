import React from 'react'
import { cn } from '@/app/lib/utils'

type PageContainerProps = Readonly<{
  children: React.ReactNode
  stack?: boolean
  className?: string
}>

export const PageContainer = ({ children, stack = false, className }: PageContainerProps) => (
  <div className={cn('px-3 py-4 sm:p-6', stack && 'flex flex-col gap-4', className)}>
    {children}
  </div>
)

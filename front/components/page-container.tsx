import React from 'react'
import { cn } from '@/app/lib/utils'

type PageContainerProps = Readonly<{
  children: React.ReactNode
  stack?: boolean
  className?: string
}>

export const PageContainer = ({ children, stack = false, className }: PageContainerProps) => (
  <div className={cn(stack && 'flex flex-col gap-4', className)}>{children}</div>
)

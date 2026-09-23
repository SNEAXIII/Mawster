'use client'

import { cn } from '@/app/lib/utils'

export interface TabItem<T extends string | number> {
  value: T
  label: string
  cy?: string
}

interface TabBarProps<T extends string | number> {
  tabs: TabItem<T>[]
  value: T
  onChange: (tab: T) => void
}

export default function TabBar<T extends string | number>({
  tabs,
  value,
  onChange,
}: Readonly<TabBarProps<T>>) {
  return (
    <div
      role='tablist'
      className='mb-4 inline-flex h-9 max-w-full items-center gap-1 overflow-x-auto rounded-lg bg-muted p-[3px] text-muted-foreground'
    >
      {tabs.map((tab) => {
        const isActive = value === tab.value
        return (
          <button
            key={tab.value}
            type='button'
            role='tab'
            aria-selected={isActive}
            onClick={() => onChange(tab.value)}
            data-cy={tab.cy ?? `tab-${tab.value}`}
            className={cn(
              'inline-flex h-full shrink-0 items-center rounded-md border border-transparent px-3 text-sm font-medium whitespace-nowrap transition-[color,box-shadow] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden',
              isActive && 'border-input bg-background text-foreground shadow-sm dark:bg-input/30'
            )}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

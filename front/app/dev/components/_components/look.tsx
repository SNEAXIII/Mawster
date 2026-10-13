'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import TabBar from '@/components/tab-bar'
import ThemePicker from '@/components/theme-picker'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'

const LOOKS = [
  { value: 'classic', label: 'Classic' },
  { value: 'new-a', label: 'A · Midnight sky' },
  { value: 'new-b', label: 'B · Abyss ice' },
  { value: 'new-c', label: 'C · Slate azure' },
] as const
type Look = (typeof LOOKS)[number]['value']

interface LookState {
  look: Look
  setLook: (look: Look) => void
  compare: boolean
  setCompare: (compare: boolean) => void
}

const LookContext = createContext<LookState | null>(null)

function useLook() {
  const ctx = useContext(LookContext)
  if (!ctx) throw new Error('useLook must be used inside LookProvider')
  return ctx
}

export function LookProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [look, setLook] = useState<Look>('new-a')
  const [compare, setCompare] = useState(false)

  // Set on <html> too: portals (dialogs, selects, tooltips) render outside the frames.
  useEffect(() => {
    const root = document.documentElement
    root.dataset.look = look
    return () => {
      delete root.dataset.look
    }
  }, [look])

  const value = useMemo(() => ({ look, setLook, compare, setCompare }), [look, compare])
  return <LookContext.Provider value={value}>{children}</LookContext.Provider>
}

export function LookToolbar() {
  const { look, setLook, compare, setCompare } = useLook()
  return (
    <div className='sticky top-0 z-30 flex flex-wrap items-center gap-4 border-b bg-background/90 px-6 py-3 backdrop-blur'>
      <Link
        href='/dev/components'
        className='text-sm font-semibold hover:text-primary'
      >
        Components
      </Link>
      <TabBar
        tabs={LOOKS.map(({ value, label }) => ({ value, label }))}
        value={look}
        onChange={setLook}
      />
      <div className='flex items-center gap-2'>
        <Switch
          id='look-compare'
          checked={compare}
          onCheckedChange={setCompare}
        />
        <Label htmlFor='look-compare'>Compare with classic</Label>
      </div>
      <ThemePicker />
    </div>
  )
}

/** Renders the showcase once, or classic and the selected look side by side. */
export function LookFrames({ children }: Readonly<{ children: ReactNode }>) {
  const { look, compare } = useLook()
  if (!compare) return children

  return (
    <div className='grid gap-4 xl:grid-cols-2'>
      {LOOKS.filter((l) => l.value === 'classic' || l.value === look).map((l) => (
        <div
          key={l.value}
          data-look={l.value}
          className='flex flex-col gap-3 rounded-lg border bg-background p-4 text-foreground'
        >
          <p className='text-xs font-medium text-muted-foreground'>{l.label}</p>
          {children}
        </div>
      ))}
    </div>
  )
}

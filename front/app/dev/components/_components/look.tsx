'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import TabBar from '@/components/tab-bar'
import ThemePicker from '@/components/theme-picker'
import { applyLook, DEFAULT_LOOK, LOOKS, readLook, type Look } from '@/app/lib/look'

const LOOK_TABS = LOOKS.map(({ value, label }) => ({ value, label }))
const SECOND_TABS = [{ value: 'off' as const, label: 'Off' }, ...LOOK_TABS]

interface LookState {
  look: Look
  selectLook: (look: Look) => void
  /** Second look shown side by side, or 'off' for a single column. */
  second: Look | 'off'
  setSecond: (look: Look | 'off') => void
}

const LookContext = createContext<LookState | null>(null)

function useLook() {
  const ctx = useContext(LookContext)
  if (!ctx) throw new Error('useLook must be used inside LookProvider')
  return ctx
}

export function LookProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [look, setLook] = useState<Look>(DEFAULT_LOOK)
  const [second, setSecond] = useState<Look | 'off'>('off')

  // Same look as the settings picker: it lives on <html>, so portals follow it too.
  useEffect(() => setLook(readLook()), [])

  const value = useMemo(() => {
    const selectLook = (next: Look) => {
      applyLook(next)
      setLook(next)
    }
    return { look, selectLook, second, setSecond }
  }, [look, second])
  return <LookContext.Provider value={value}>{children}</LookContext.Provider>
}

export function LookToolbar() {
  const { look, selectLook, second, setSecond } = useLook()
  return (
    <div className='sticky top-0 z-30 flex flex-wrap items-center gap-4 border-b bg-background/90 px-6 py-3 backdrop-blur'>
      <Link
        href='/dev/components'
        className='text-sm font-semibold hover:text-primary'
      >
        Components
      </Link>
      <TabBar
        tabs={LOOK_TABS}
        value={look}
        onChange={selectLook}
      />
      <span className='text-xs text-muted-foreground'>vs</span>
      <TabBar
        tabs={SECOND_TABS}
        value={second}
        onChange={setSecond}
      />
      <ThemePicker />
    </div>
  )
}

/** Renders the showcase once, or the two selected looks side by side. */
export function LookFrames({ children }: Readonly<{ children: ReactNode }>) {
  const { look, second } = useLook()
  if (second === 'off' || second === look) return children

  return (
    <div className='grid gap-4 xl:grid-cols-2'>
      {[look, second].map((l) => (
        <div
          key={l}
          data-look={l}
          className='flex flex-col gap-3 rounded-lg border bg-background p-4 text-foreground'
        >
          <p className='text-xs font-medium text-muted-foreground'>
            {LOOKS.find((x) => x.value === l)?.label}
          </p>
          {children}
        </div>
      ))}
    </div>
  )
}

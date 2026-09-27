'use client'

import { createContext, useContext } from 'react'
import type { usePlanEditor } from '@/app/game/defense/_hooks/use-plan-editor'

type DefenseActionsContextValue = ReturnType<typeof usePlanEditor>

const DefenseActionsContext = createContext<DefenseActionsContextValue | null>(null)

export const DefenseActionsProvider = DefenseActionsContext.Provider

export function useDefenseActionsContext(): DefenseActionsContextValue {
  const ctx = useContext(DefenseActionsContext)
  if (!ctx) throw new Error('useDefenseActionsContext must be used within DefenseActionsProvider')
  return ctx
}

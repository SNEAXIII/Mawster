'use client';

import { createContext, useContext } from 'react';
import type { useDefenseActions } from './use-defense-actions';

type DefenseActionsContextValue = ReturnType<typeof useDefenseActions>;

const DefenseActionsContext = createContext<DefenseActionsContextValue | null>(null);

export const DefenseActionsProvider = DefenseActionsContext.Provider;

export function useDefenseActionsContext(): DefenseActionsContextValue {
  const ctx = useContext(DefenseActionsContext);
  if (!ctx) throw new Error('useDefenseActionsContext must be used within DefenseActionsProvider');
  return ctx;
}

'use client'

import type { ReactNode } from 'react'
import { useAuthStatus } from '@/hooks/use-auth-status'
import { PlayerDashboard } from './dashboard/player-dashboard'

// The landing stays the default render so the prerendered HTML keeps it for visitors and crawlers.
export function HomeGate({ landing }: Readonly<{ landing: ReactNode }>) {
  const { isAuthenticated } = useAuthStatus()
  return isAuthenticated ? <PlayerDashboard /> : landing
}

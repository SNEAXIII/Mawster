'use client'

import type { ReactNode } from 'react'
import { useAuthStatus } from '@/hooks/use-auth-status'
import { SignedInHome } from './signed-in-home'

// The landing stays the default render so the prerendered HTML keeps it for visitors and crawlers.
export function HomeGate({ landing }: Readonly<{ landing: ReactNode }>) {
  const { isAuthenticated, userName } = useAuthStatus()
  return isAuthenticated ? <SignedInHome userName={userName} /> : landing
}

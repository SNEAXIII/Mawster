'use client'

import { useSession } from 'next-auth/react'

export function useAuthStatus() {
  const { data: session, status } = useSession()
  return {
    isAuthenticated: Boolean(session && !session.error && session.user),
    isLoading: status === 'loading',
  }
}

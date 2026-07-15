'use client'

import { signOut } from 'next-auth/react'

/**
 * Single sign-out path for the whole app.
 *
 * Letting NextAuth own the redirect (`redirect: true`, its default) matters:
 * with `redirect: false` the session flips to unauthenticated while a guarded
 * page is still mounted, and `useRequiredSession` races us to
 * `/login?callbackUrl=…` before our own navigation lands.
 */
export async function signOutAndRedirect(redirectTo = '/') {
  try {
    await signOut({ redirectTo })
  } catch (error) {
    console.error('Sign out error:', error)
  }
}

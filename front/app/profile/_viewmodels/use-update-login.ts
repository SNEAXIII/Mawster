'use client'

import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { updateLogin } from '@/app/services/users'

export function useUpdateLogin() {
  const router = useRouter()
  const { update } = useSession()

  return async (login: string) => {
    await updateLogin(login)
    // The session caches the backend profile on the token, so a router refresh
    // alone would keep showing the old name everywhere else (the sidebar). The
    // argument is mandatory: bare, next-auth sends a GET and the jwt callback
    // gets no `update` trigger.
    await update({})
    router.refresh()
  }
}

import type { JWT } from 'next-auth/jwt'
import { getServerApiUrl } from '@/app/lib/serverApiUrl'

export interface BackendProfile {
  id: string
  login: string | null
  email: string | null
  role: string
  discord_id: string | null
  google_id: string | null
  created_at: string | null
}

/**
 * Fetches the backend profile and stores it on the NextAuth token.
 *
 * Called only from the `jwt` callback, at the moments the session cookie is
 * actually rewritten: sign-in, an explicit `update()`, and a token refresh.
 * The `session` callback then reads `token.profile` with zero network. It used
 * to hit /auth/session on every session read, and the API proxy calls `auth()`
 * on every request — so a single front-end API call cost two backend requests,
 * doubled again by the 10s pollings on the war and defense pages.
 *
 * A failed fetch keeps the previous profile rather than clearing it: a blip on
 * the profile endpoint must not log the user out.
 */
export async function withBackendProfile(token: JWT): Promise<JWT> {
  if (!token.accessToken || token.expired) return token

  try {
    const res = await fetch(`${getServerApiUrl()}/auth/session`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token.accessToken}` },
    })
    if (!res.ok) return token

    return { ...token, profile: (await res.json()) as BackendProfile }
  } catch (e) {
    console.error('Erreur en synchronisant la session avec /auth/session :', e)
    return token
  }
}

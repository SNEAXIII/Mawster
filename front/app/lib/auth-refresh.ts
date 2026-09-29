import type { JWT } from 'next-auth/jwt'
import { getServerApiUrl } from '@/app/lib/serverApiUrl'

export const decodeJwt = <T>(token: string): T | null => {
  try {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()) as T
  } catch {
    return null
  }
}

export interface JwtPayload {
  user_id: string
  role: string
  type: string
  exp: number
}

interface BackendTokens {
  access_token?: string
  refresh_token?: string
}

/** NextAuth token fields for a backend `{access_token, refresh_token}` pair, or null if undecodable. */
export function tokenFromBackend(data: BackendTokens) {
  const decoded = data.access_token ? decodeJwt<JwtPayload>(data.access_token) : null
  if (!decoded || typeof decoded.exp !== 'number') return null
  return {
    id: decoded.user_id,
    role: decoded.role,
    accessToken: data.access_token,
    backendRefreshToken: data.refresh_token,
    accessTokenExpires: decoded.exp * 1000,
    expired: false,
    backendAuthenticated: true,
  }
}

/**
 * Rafraichit le token backend via le refresh_token backend.
 * Si le refresh backend échoue, tente un re-login via Discord refresh token.
 * Partagé entre le callback JWT NextAuth et le proxy API.
 */
export async function refreshBackendToken(token: JWT): Promise<JWT> {
  try {
    // 1. Try backend refresh token first
    if (token.backendRefreshToken) {
      const refreshRes = await fetch(`${getServerApiUrl()}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: token.backendRefreshToken }),
      })

      if (refreshRes.ok) {
        const fields = tokenFromBackend(await refreshRes.json())
        if (fields) return { ...token, ...fields }
      }
    }

    // 2. Fallback: use Discord refresh token to re-authenticate
    if (token.discordRefreshToken) {
      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: token.discordRefreshToken,
        client_id: process.env.DISCORD_CLIENT_ID!,
        client_secret: process.env.DISCORD_CLIENT_SECRET!,
      })

      const discordRes = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      })

      if (!discordRes.ok) {
        console.error('Echec du refresh Discord:', discordRes.status)
        return { ...token, expired: true, backendAuthenticated: false }
      }

      const discordTokens = await discordRes.json()

      const backendRes = await fetch(`${getServerApiUrl()}/auth/discord`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: discordTokens.access_token }),
      })

      if (!backendRes.ok) {
        console.error('Echec backend apres refresh Discord:', backendRes.status)
        return { ...token, expired: true, backendAuthenticated: false }
      }

      const fields = tokenFromBackend(await backendRes.json())

      if (!fields) {
        console.error('Impossible de décoder le JWT backend après refresh')
        return { ...token, expired: true, backendAuthenticated: false }
      }

      return {
        ...token,
        ...fields,
        discordRefreshToken: discordTokens.refresh_token ?? token.discordRefreshToken,
      }
    }

    return { ...token, expired: true, backendAuthenticated: false }
  } catch (error) {
    console.error('Erreur lors du refresh token:', error)
    return { ...token, expired: true, backendAuthenticated: false }
  }
}

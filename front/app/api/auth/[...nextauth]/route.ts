import NextAuth from 'next-auth'
import Discord from 'next-auth/providers/discord'
import Google from 'next-auth/providers/google'
import Credentials from 'next-auth/providers/credentials'
import jwt from 'jsonwebtoken'
import { getServerApiUrl } from '@/app/lib/serverApiUrl'
import { refreshBackendToken } from '@/app/lib/auth-refresh'

import { isServerDev } from '@/app/lib/dev-mode'

const IS_DEV = isServerDev()

interface JwtPayload {
  user_id: string
  role: string
  type: string
}

export const {
  handlers: { GET, POST },
  auth,
} = NextAuth({
  providers: [
    Discord({
      clientId: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
      authorization: {
        params: {
          scope: 'identify email',
        },
      },
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          scope: 'openid email profile',
        },
      },
    }),
    // Dev-only: pick a user from the database without Discord
    ...(IS_DEV
      ? [
          Credentials({
            id: 'dev-login',
            name: 'Dev Login',
            credentials: {
              user_id: { label: 'User ID', type: 'text' },
            },
            async authorize(credentials) {
              if (!credentials?.user_id) return null

              const res = await fetch(`${getServerApiUrl()}/dev/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: credentials.user_id }),
              })

              if (!res.ok) return null

              const data = await res.json()
              const decoded = jwt.decode(data.access_token) as JwtPayload | null
              if (!decoded) return null

              return {
                id: decoded.user_id,
                role: decoded.role,
                accessToken: data.access_token,
                refreshToken: data.refresh_token,
              }
            },
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ account }) {
      const provider = account?.provider
      if (provider !== 'discord' && provider !== 'google') return true
      if (!account?.access_token) return '/login?error=GENERIC'

      try {
        const res = await fetch(`${getServerApiUrl()}/auth/${provider}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ access_token: account.access_token }),
        })

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}))
          const code = errorData?.message?.code ?? 'GENERIC'
          console.error(`Erreur backend ${provider} auth:`, res.status, errorData)
          return `/login?error=${encodeURIComponent(code)}`
        }

        const data = await res.json()
        const decoded = jwt.decode(data.access_token) as JwtPayload | null
        if (!decoded) {
          console.error(`Impossible de décoder le JWT backend (${provider})`)
          return '/login?error=GENERIC'
        }

        account.backendAccessToken = data.access_token
        account.backendRefreshToken = data.refresh_token
        account.backendUserId = decoded.user_id
        account.backendRole = decoded.role
        return true
      } catch (error) {
        console.error(`Erreur lors de l'auth ${provider}:`, error)
        return '/login?error=GENERIC'
      }
    },
    async jwt({ token, user, account, profile: _profile }) {
      // Dev login via CredentialsProvider (no Discord)
      if (account?.provider === 'dev-login' && user) {
        return {
          ...token,
          id: user.id,
          role: user.role,
          accessToken: user.accessToken,
          backendRefreshToken: user.refreshToken,
          accessTokenExpires: Date.now() + 60 * 60 * 1000,
          expired: false,
          backendAuthenticated: true,
        }
      }

      // Login initial via OAuth: the exchange already happened in signIn
      if (account?.provider === 'discord' || account?.provider === 'google') {
        return {
          ...token,
          id: account.backendUserId,
          role: account.backendRole,
          accessToken: account.backendAccessToken,
          backendRefreshToken: account.backendRefreshToken,
          accessTokenExpires: Date.now() + 60 * 60 * 1000,
          ...(account.provider === 'discord' ? { discordRefreshToken: account.refresh_token } : {}),
          expired: false,
          backendAuthenticated: true,
        }
      }

      // Requêtes subséquentes : vérifier l'expiration du JWT backend
      if (token.accessTokenExpires && Date.now() < (token.accessTokenExpires as number)) {
        return token
      }

      // JWT backend expiré : tenter un refresh
      return await refreshBackendToken(token)
    },
    async session({ session, token }) {
      if (token.expired || !token.backendAuthenticated) {
        return {
          ...session,
          user: undefined,
          error: 'TokenExpiredError',
        }
      }

      // Fetch full user profile from backend /auth/session
      try {
        if (token.accessToken) {
          const res = await fetch(`${getServerApiUrl()}/auth/session`, {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${token.accessToken}`,
            },
          })

          if (res.ok) {
            const userProfile = await res.json()
            return {
              ...session,
              accessToken: token.accessToken as string,
              user: {
                ...session.user,
                id: userProfile.id ?? token.id,
                name: userProfile.login ?? token.name,
                email: userProfile.email ?? token.email,
                role: userProfile.role ?? token.role,
                discord_id: userProfile.discord_id ?? null,
                google_id: userProfile.google_id ?? null,
                created_at: userProfile.created_at ?? token.created_at,
              },
            }
          }
        }
      } catch (e) {
        console.error('Erreur en synchronisant la session avec /auth/session :', e)
      }

      return {
        ...session,
        accessToken: token.accessToken as string,
        user: {
          ...session.user,
          id: token.id,
          role: token.role,
        },
      }
    },
  },
  pages: {
    signIn: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
  trustHost: true,
  logger: {
    error(error: Error) {
      console.error(error)
    },
    warn(code: string) {
      console.warn(code)
    },
    debug(message: string, metadata?: unknown) {
      if (process.env.NODE_ENV === 'development') {
        console.debug(message, metadata)
      }
    },
  },
  session: {
    strategy: 'jwt',
  },
  debug: process.env.NODE_ENV === 'development',
})

declare module 'next-auth' {
  interface Session {
    accessToken?: string
    user: {
      id: string
      name: string
      email: string
      role: string
      discord_id: string | null
      google_id: string | null
      created_at: string | null
    }
    error?: string
  }
  interface User {
    role?: string
    accessToken?: string
    refreshToken?: string
  }
  interface Account {
    backendAccessToken?: string
    backendRefreshToken?: string
    backendUserId?: string
    backendRole?: string
  }
}

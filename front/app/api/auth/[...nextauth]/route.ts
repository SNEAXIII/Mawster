import NextAuth from 'next-auth'
import Discord from 'next-auth/providers/discord'
import Google from 'next-auth/providers/google'
import Credentials from 'next-auth/providers/credentials'
import jwt from 'jsonwebtoken'
import { getServerApiUrl } from '@/app/lib/serverApiUrl'
import { refreshBackendToken } from '@/app/lib/auth-refresh'
import { withBackendProfile } from '@/app/lib/backend-profile'

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
    async jwt({ token, user, account, trigger, profile: _profile }) {
      // Dev login via CredentialsProvider (no Discord)
      if (account?.provider === 'dev-login' && user) {
        return await withBackendProfile({
          ...token,
          id: user.id,
          role: user.role,
          accessToken: user.accessToken,
          backendRefreshToken: user.refreshToken,
          accessTokenExpires: Date.now() + 60 * 60 * 1000,
          expired: false,
          backendAuthenticated: true,
        })
      }

      // Login initial via OAuth: the exchange already happened in signIn
      if (account?.provider === 'discord' || account?.provider === 'google') {
        return await withBackendProfile({
          ...token,
          id: account.backendUserId,
          role: account.backendRole,
          accessToken: account.backendAccessToken,
          backendRefreshToken: account.backendRefreshToken,
          accessTokenExpires: Date.now() + 60 * 60 * 1000,
          ...(account.provider === 'discord' ? { discordRefreshToken: account.refresh_token } : {}),
          expired: false,
          backendAuthenticated: true,
        })
      }

      // Explicit `useSession().update()`: the caller just changed the profile
      // and asks for it to be re-read. Now the only way to refresh it before
      // the backend JWT expires, since `session` no longer calls the backend.
      if (trigger === 'update') {
        return await withBackendProfile(token)
      }

      // Subsequent requests: check the backend JWT for expiry. A still-valid
      // token minted before `profile` existed carries none — backfill it once
      // rather than serve a blank username until the token expires.
      if (token.accessTokenExpires && Date.now() < (token.accessTokenExpires as number)) {
        return token.profile ? token : await withBackendProfile(token)
      }

      // Backend JWT expired: attempt a refresh
      return await withBackendProfile(await refreshBackendToken(token))
    },
    async session({ session, token }) {
      if (token.expired || !token.backendAuthenticated) {
        return {
          ...session,
          user: undefined,
          error: 'TokenExpiredError',
        }
      }

      // Read-only: the profile was fetched by the jwt callback and cached on
      // the token. Never fetch here — this callback runs on every `auth()`,
      // and the API proxy calls `auth()` on every single request.
      const profile = token.profile

      return {
        ...session,
        accessToken: token.accessToken as string,
        user: {
          ...session.user,
          id: profile?.id ?? token.id ?? '',
          name: profile?.login ?? token.name ?? '',
          email: profile?.email ?? token.email ?? '',
          role: profile?.role ?? token.role ?? '',
          discord_id: profile?.discord_id ?? null,
          google_id: profile?.google_id ?? null,
          created_at: profile?.created_at ?? token.created_at ?? null,
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

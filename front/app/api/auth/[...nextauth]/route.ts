import NextAuth from 'next-auth';
import Discord from 'next-auth/providers/discord';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import jwt from 'jsonwebtoken';
import { getServerApiUrl } from '@/app/lib/serverApiUrl';
import { refreshBackendToken } from '@/app/lib/auth-refresh';

import { isServerDev } from '@/app/lib/dev-mode';

const IS_DEV = isServerDev();

interface JwtPayload {
  user_id: string;
  role: string;
  type: string;
}

interface UserProfile {
  id: string;
  login: string;
  email: string;
  role: string;
  discord_id: string | null;
  google_id: string | null;
  created_at: string;
}

async function fetchUserProfile(accessToken: string): Promise<UserProfile | null> {
  try {
    const res = await fetch(`${getServerApiUrl()}/auth/session`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return res.ok ? ((await res.json()) as UserProfile) : null;
  } catch {
    return null;
  }
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
              if (!credentials?.user_id) return null;

              const res = await fetch(`${getServerApiUrl()}/dev/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: credentials.user_id }),
              });

              if (!res.ok) return null;

              const data = await res.json();
              const decoded = jwt.decode(data.access_token) as JwtPayload | null;
              if (!decoded) return null;

              return {
                id: decoded.user_id,
                role: decoded.role,
                accessToken: data.access_token,
                refreshToken: data.refresh_token,
              };
            },
          }),
        ]
      : []),
  ],
  callbacks: {
    async jwt({ token, user, account, profile: _profile }) {
      // Dev login via CredentialsProvider (no Discord)
      if (account?.provider === 'dev-login' && user) {
        const profile = await fetchUserProfile(user.accessToken as string);
        return {
          ...token,
          id: user.id,
          role: user.role,
          accessToken: user.accessToken,
          backendRefreshToken: user.refreshToken,
          accessTokenExpires: Date.now() + 60 * 60 * 1000,
          expired: false,
          backendAuthenticated: true,
          cachedLogin: profile?.login ?? null,
          cachedDiscordId: profile?.discord_id ?? null,
          cachedGoogleId: profile?.google_id ?? null,
          cachedCreatedAt: profile?.created_at ?? null,
        };
      }

      // Login initial via Google OAuth
      if (account?.provider === 'google' && account.access_token) {
        try {
          const res = await fetch(`${getServerApiUrl()}/auth/google`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ access_token: account.access_token }),
          });

          if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            console.error('Erreur backend Google auth:', res.status, errorData);
            return { ...token, expired: true, backendAuthenticated: false };
          }

          const data = await res.json();
          const decoded = jwt.decode(data.access_token) as JwtPayload | null;

          if (!decoded) {
            console.error('Impossible de décoder le JWT backend (Google)');
            return { ...token, expired: true, backendAuthenticated: false };
          }

          const profile = await fetchUserProfile(data.access_token);
          return {
            ...token,
            id: decoded.user_id,
            role: decoded.role,
            accessToken: data.access_token,
            backendRefreshToken: data.refresh_token,
            accessTokenExpires: Date.now() + 60 * 60 * 1000,
            expired: false,
            backendAuthenticated: true,
            cachedLogin: profile?.login ?? null,
            cachedDiscordId: profile?.discord_id ?? null,
            cachedGoogleId: profile?.google_id ?? null,
            cachedCreatedAt: profile?.created_at ?? null,
          };
        } catch (error) {
          console.error("Erreur lors de l'auth Google:", error);
          return { ...token, expired: true, backendAuthenticated: false };
        }
      }

      // Login initial via Discord OAuth
      if (account?.provider === 'discord' && account.access_token) {
        try {
          const res = await fetch(`${getServerApiUrl()}/auth/discord`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ access_token: account.access_token }),
          });

          if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            console.error('Erreur backend Discord auth:', res.status, errorData);
            return { ...token, expired: true, backendAuthenticated: false };
          }

          const data = await res.json();
          const decoded = jwt.decode(data.access_token) as JwtPayload | null;

          if (!decoded) {
            console.error('Impossible de décoder le JWT backend (Discord)');
            return { ...token, expired: true, backendAuthenticated: false };
          }

          const profile = await fetchUserProfile(data.access_token);
          return {
            ...token,
            id: decoded.user_id,
            role: decoded.role,
            accessToken: data.access_token,
            backendRefreshToken: data.refresh_token,
            accessTokenExpires: Date.now() + 60 * 60 * 1000,
            discordRefreshToken: account.refresh_token,
            expired: false,
            backendAuthenticated: true,
            cachedLogin: profile?.login ?? null,
            cachedDiscordId: profile?.discord_id ?? null,
            cachedGoogleId: profile?.google_id ?? null,
            cachedCreatedAt: profile?.created_at ?? null,
          };
        } catch (error) {
          console.error("Erreur lors de l'auth Discord:", error);
          return { ...token, expired: true, backendAuthenticated: false };
        }
      }

      // Requêtes subséquentes : vérifier l'expiration du JWT backend
      if (token.accessTokenExpires && Date.now() < (token.accessTokenExpires as number)) {
        return token;
      }

      // JWT backend expiré : tenter un refresh
      return await refreshBackendToken(token);
    },
    async session({ session, token }) {
      if (token.expired || !token.backendAuthenticated) {
        return {
          ...session,
          user: undefined,
          error: 'TokenExpiredError',
        };
      }

      return {
        ...session,
        accessToken: token.accessToken as string,
        user: {
          ...session.user,
          id: (token.id as string) ?? '',
          name: (token.cachedLogin ?? token.name) as string,
          email: token.email as string,
          role: token.role,
          discord_id: (token.cachedDiscordId ?? null) as string | null,
          google_id: (token.cachedGoogleId ?? null) as string | null,
          created_at: (token.cachedCreatedAt ?? null) as string | null,
        },
      };
    },
  },
  pages: {
    signIn: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
  trustHost: true,
  logger: {
    error(error: Error) {
      console.error(error);
    },
    warn(code: string) {
      console.warn(code);
    },
    debug(message: string, metadata?: unknown) {
      if (process.env.NODE_ENV === 'development') {
        console.debug(message, metadata);
      }
    },
  },
  session: {
    strategy: 'jwt',
  },
  debug: process.env.NODE_ENV === 'development',
});

declare module 'next-auth' {
  interface Session {
    accessToken?: string;
    user: {
      id: string;
      name: string;
      email: string;
      role: string;
      discord_id: string | null;
      google_id: string | null;
      created_at: string | null;
    };
    error?: string;
  }
}

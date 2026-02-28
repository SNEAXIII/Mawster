import NextAuth from 'next-auth';
import Discord from 'next-auth/providers/discord';
import jwt from 'jsonwebtoken';
import { SERVER_API_URL } from '@/next.config';

interface JwtPayload {
  user_id: string;
  role: string;
  type: string;
}

/**
 * Rafraichit le token backend via le refresh_token backend.
 * Si le refresh backend échoue, tente un re-login via Discord refresh token.
 */
async function refreshBackendToken(token: any): Promise<any> {
  try {
    // 1. Try backend refresh token first
    if (token.backendRefreshToken) {
      const refreshRes = await fetch(`${SERVER_API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: token.backendRefreshToken }),
      });

      if (refreshRes.ok) {
        const data = await refreshRes.json();
        const decoded = jwt.decode(data.access_token) as JwtPayload | null;

        if (decoded) {
          console.log('Token rafraichi avec succes via backend refresh token');
          return {
            ...token,
            id: decoded.user_id,
            role: decoded.role,
            accessToken: data.access_token,
            backendRefreshToken: data.refresh_token,
            accessTokenExpires: Date.now() + 60 * 60 * 1000,
            expired: false,
            backendAuthenticated: true,
          };
        }
      }
    }

    // 2. Fallback: use Discord refresh token to re-authenticate
    if (token.discordRefreshToken) {
      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: token.discordRefreshToken,
        client_id: process.env.DISCORD_CLIENT_ID!,
        client_secret: process.env.DISCORD_CLIENT_SECRET!,
      });

      const discordRes = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });

      if (!discordRes.ok) {
        console.error('Echec du refresh Discord:', discordRes.status);
        return { ...token, expired: true, backendAuthenticated: false };
      }

      const discordTokens = await discordRes.json();

      const backendRes = await fetch(`${SERVER_API_URL}/auth/discord`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: discordTokens.access_token }),
      });

      if (!backendRes.ok) {
        console.error('Echec backend apres refresh Discord:', backendRes.status);
        return { ...token, expired: true, backendAuthenticated: false };
      }

      const data = await backendRes.json();
      const decoded = jwt.decode(data.access_token) as JwtPayload | null;

      if (!decoded) {
        console.error('Impossible de décoder le JWT backend après refresh');
        return { ...token, expired: true, backendAuthenticated: false };
      }

      console.log('Token rafraichi avec succes via Discord re-auth');

      return {
        ...token,
        id: decoded.user_id,
        role: decoded.role,
        accessToken: data.access_token,
        backendRefreshToken: data.refresh_token,
        accessTokenExpires: Date.now() + 60 * 60 * 1000,
        discordRefreshToken: discordTokens.refresh_token ?? token.discordRefreshToken,
        expired: false,
        backendAuthenticated: true,
      };
    }

    return { ...token, expired: true, backendAuthenticated: false };
  } catch (error) {
    console.error('Erreur lors du refresh token:', error);
    return { ...token, expired: true, backendAuthenticated: false };
  }
}

export const {
  handlers: { GET, POST },
} = NextAuth({
  providers: [
    Discord({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'identify email',
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account, profile }: { token: any; user: any; account?: any; profile?: any }) {
      // Login initial via Discord OAuth
      if (account?.provider === 'discord' && account.access_token) {
        try {
          const res = await fetch(`${SERVER_API_URL}/auth/discord`, {
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
          };
        } catch (error) {
          console.error('Erreur lors de l\'auth Discord:', error);
          return { ...token, expired: true, backendAuthenticated: false };
        }
      }

      // Requêtes subséquentes : vérifier l'expiration du JWT backend
      if (token.accessTokenExpires && Date.now() < (token.accessTokenExpires as number)) {
        return token;
      }

      // JWT backend expiré : tenter un refresh
      console.log('JWT backend expire, tentative de refresh...');
      return await refreshBackendToken(token);
    },
    async session({ session, token }: { session: any; token: any }) {
      if (token.expired || !token.backendAuthenticated) {
        return {
          ...session,
          user: undefined,
          error: 'TokenExpiredError',
        };
      }

      // Fetch full user profile from backend /auth/session
      try {
        if (token.accessToken) {
          const res = await fetch(`${SERVER_API_URL}/auth/session`, {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${token.accessToken}`,
            },
          });

          if (res.ok) {
            const userProfile = await res.json();
            return {
              ...session,
              user: {
                ...session.user,
                id: userProfile.id ?? token.id,
                name: userProfile.login ?? token.name,
                email: userProfile.email ?? token.email,
                role: userProfile.role ?? token.role,
                avatar_url: userProfile.avatar_url ?? token.avatar_url,
                discord_id: userProfile.discord_id ?? token.discord_id,
                created_at: userProfile.created_at ?? token.created_at,
              },
            };
          }
        }
      } catch (e) {
        console.error('Erreur en synchronisant la session avec /auth/session :', e);
      }

      return {
        ...session,
        user: {
          ...session.user,
          id: token.id,
          role: token.role,
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
    user: {
      id: string;
      name: string;
      email: string;
      role: string;
      avatar_url: string | null;
      discord_id: string;
      created_at: string | null;
    };
    error?: string;
  }
}

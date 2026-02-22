import NextAuth from 'next-auth';
import Discord from 'next-auth/providers/discord';
import jwt from 'jsonwebtoken';
import { SERVER_API_URL } from '@/next.config';

interface JwtPayload {
  user_id: string;
  sub: string;
  email: string;
  role: string;
  avatar_url: string | null;
  discord_id: string;
  created_at: string | null;
}

/**
 * Rafraichit le token Discord via le refresh_token,
 * puis ré-authentifie auprès du backend pour obtenir un nouveau JWT.
 */
async function refreshBackendToken(token: any): Promise<any> {
  try {
    // 1. Utiliser le refresh_token Discord pour obtenir un nouvel access_token Discord
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

    // 2. Ré-authentifier auprès du backend avec le nouvel access_token Discord
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

    console.log('Token rafraichi avec succes pour', decoded.sub);

    return {
      ...token,
      id: decoded.user_id,
      name: decoded.sub,
      email: decoded.email,
      role: decoded.role,
      avatar_url: decoded.avatar_url,
      discord_id: decoded.discord_id,
      created_at: decoded.created_at,
      accessToken: data.access_token,
      accessTokenExpires: Date.now() + 60 * 60 * 1000,
      // Mettre a jour le refresh token Discord (Discord peut en renvoyer un nouveau)
      discordRefreshToken: discordTokens.refresh_token ?? token.discordRefreshToken,
      expired: false,
      backendAuthenticated: true,
    };
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
          // Envoyer uniquement le token d'acces Discord au backend
          // Le backend verifie le token directement aupres de Discord
          const res = await fetch(`${SERVER_API_URL}/auth/discord`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ access_token: account.access_token }),
          });

          if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            console.error('Erreur backend Discord auth:', res.status, errorData);
            // Backend inaccessible ou erreur : ne PAS marquer comme authentifié
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
            name: decoded.sub,
            email: decoded.email,
            role: decoded.role,
            avatar_url: decoded.avatar_url,
            discord_id: decoded.discord_id,
            created_at: decoded.created_at,
            accessToken: data.access_token,
            accessTokenExpires: Date.now() + 60 * 60 * 1000,
            // Stocker le refresh_token Discord pour le renouvellement
            discordRefreshToken: account.refresh_token,
            expired: false,
            backendAuthenticated: true,
          };
        } catch (error) {
          console.error('Erreur lors de l\'auth Discord:', error);
          // ECONNREFUSED etc. : ne PAS marquer comme authentifié
          return { ...token, expired: true, backendAuthenticated: false };
        }
      }

      // Requêtes subséquentes : vérifier l'expiration du JWT backend
      if (token.accessTokenExpires && Date.now() < (token.accessTokenExpires as number)) {
        return token;
      }

      // JWT backend expiré : tenter un refresh via Discord
      if (token.discordRefreshToken) {
        console.log('JWT backend expire, tentative de refresh via Discord...');
        return await refreshBackendToken(token);
      }

      // Pas de refresh token disponible
      return {
        ...token,
        expired: true,
        backendAuthenticated: false,
      };
    },
    async session({ session, token }: { session: any; token: any }) {
      // Si le backend n'a jamais authentifié l'utilisateur ou le token est expiré,
      // retourner une session avec erreur et sans données utilisateur
      if (token.expired || !token.backendAuthenticated) {
        return {
          ...session,
          user: undefined,
          error: 'TokenExpiredError',
        };
      }

      // Si on a un accessToken backend, demander le profil au backend
      // pour s'assurer que la session NextAuth reflète l'état serveur
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
                name: userProfile.username ?? token.name,
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
          name: token.name,
          email: token.email,
          role: token.role,
          avatar_url: token.avatar_url,
          discord_id: token.discord_id,
          created_at: token.created_at,
        },
        // accessToken volontairement absent : le JWT backend
        // reste côté serveur et est utilisé via /api/back proxy
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

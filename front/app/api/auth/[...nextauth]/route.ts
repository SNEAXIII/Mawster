import NextAuth from 'next-auth';
import Discord from 'next-auth/providers/discord';
import jwt from 'jsonwebtoken';
import { SERVER_API_URL } from '@/next.config';

interface JwtPayload {
  user_id: string;
  sub: string;
  email: string;
  role: string;
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
    async jwt({ token, user, account, profile }: { token: any; user: any; account: any; profile?: any }) {
      // Login via Discord OAuth
      if (account?.provider === 'discord' && profile) {
        try {
          // Appeler le backend FastAPI pour créer/retrouver l'utilisateur
          const discordProfile = {
            discord_id: profile.id,
            email: profile.email || `${profile.id}@discord.placeholder`,
            username: profile.username || profile.global_name || `discord_${profile.id}`,
            avatar_url: profile.avatar
              ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
              : null,
          };

          const res = await fetch(`${SERVER_API_URL}/auth/discord`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(discordProfile),
          });

          if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            console.error('Erreur backend Discord auth:', res.status, errorData);
            return { ...token, expired: true };
          }

          const data = await res.json();
          const decoded = jwt.decode(data.access_token) as JwtPayload | null;

          if (!decoded) {
            console.error('Impossible de décoder le JWT backend (Discord)');
            return { ...token, expired: true };
          }

          return {
            ...token,
            id: decoded.user_id,
            name: decoded.sub,
            email: decoded.email,
            role: decoded.role,
            accessToken: data.access_token,
            accessTokenExpires: Date.now() + 60 * 60 * 1000,
            expired: false,
          };
        } catch (error) {
          console.error('Erreur lors de l\'auth Discord:', error);
          return { ...token, expired: true };
        }
      }

      // Vérification expiration pour les requêtes subséquentes
      if (Date.now() < (token.accessTokenExpires as number)) {
        return token;
      }
      return {
        ...token,
        expired: true,
      };
    },
    async session({ session, token }: { session: any; token: any }) {
      if (token.expired) {
        return {
          ...session,
          error: 'TokenExpiredError',
        };
      }
      return {
        ...session,
        user: {
          ...session.user,
          id: token.id,
          name: token.name,
          email: token.email,
          role: token.role,
        },
        accessToken: token.accessToken,
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
    };
    accessToken: string;
    expired: boolean;
  }
}

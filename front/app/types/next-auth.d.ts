import 'next-auth';

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

  interface User {
    id: string;
    name?: string;
    email?: string;
    role?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accessToken: string;
    accessTokenExpires: number;
    expired: boolean;
    user_id: string;
    sub: string;
    email: string;
    role: string;
    avatar_url: string | null;
    discord_id: string;
    created_at: string | null;
  }
}

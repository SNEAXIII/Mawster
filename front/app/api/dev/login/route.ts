import { NextRequest, NextResponse } from 'next/server';
import { encode } from '@auth/core/jwt';
import jwt from 'jsonwebtoken';
import { isServerDev } from '@/app/lib/dev-mode';
import { getServerApiUrl } from '@/app/lib/serverApiUrl';

interface BackendJwtPayload {
  user_id: string;
  role: string;
}

const COOKIE_NAME = 'authjs.session-token';

/**
 * Dev-only: create a NextAuth session cookie programmatically.
 * Accepts { user_id } and returns { sessionToken } — a JWT-encoded
 * NextAuth session cookie value that Cypress can set directly.
 */
export async function POST(req: NextRequest) {
  if (!isServerDev()) {
    return NextResponse.json({ message: 'Not found' }, { status: 404 });
  }

  try {
    const { user_id } = await req.json();

    const backendRes = await fetch(`${getServerApiUrl()}/dev/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id }),
    });

    if (!backendRes.ok) {
      return NextResponse.json({ message: 'Login failed' }, { status: 401 });
    }

    const data = await backendRes.json();
    const decoded = jwt.decode(data.access_token) as BackendJwtPayload | null;

    if (!decoded) {
      return NextResponse.json({ message: 'Invalid token' }, { status: 500 });
    }

    const sessionToken = await encode({
      token: {
        id: decoded.user_id,
        role: decoded.role,
        accessToken: data.access_token,
        backendRefreshToken: data.refresh_token,
        accessTokenExpires: Date.now() + 60 * 60 * 1000,
        expired: false,
        backendAuthenticated: true,
      },
      secret: process.env.NEXTAUTH_SECRET!,
      salt: COOKIE_NAME,
    });

    return NextResponse.json({ sessionToken });
  } catch (error) {
    console.error('[dev/login] Error:', error);
    return NextResponse.json({ message: 'Internal error' }, { status: 500 });
  }
}

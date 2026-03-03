import { NextResponse } from 'next/server';
import { SERVER_API_URL } from '@/next.config';

/**
 * Dev-only proxy: fetches the list of users from the backend
 * without requiring authentication. Both this route and the backend
 * endpoint are disabled in production.
 */
export async function GET() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ message: 'Not found' }, { status: 404 });
  }

  try {
    const res = await fetch(`${SERVER_API_URL}/auth/dev/users`);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('[dev/users] Backend unreachable:', error);
    return NextResponse.json({ message: 'Backend unreachable' }, { status: 502 });
  }
}
